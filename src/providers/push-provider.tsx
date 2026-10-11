'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  getPushStatus,
  registerPushSubscription,
  removeAllPushSubscriptions,
  removePushSubscription,
  sendTestPush,
} from '@/api/notifications.api';
import { isApiError } from '@/api/errors';
import { env } from '@/lib/env';
import { queryKeys } from '@/lib/query-keys';
import {
  getLocalSubscription,
  getPermission,
  isPushCapable,
  requestPermission,
  showLocalNotification,
  subscribeToPush,
  syncAppBadge,
  unsubscribeLocally,
  type LocalPushSubscription,
} from '@/lib/push';
import { useAuth } from './auth-provider';

/**
 * PWA push alerts (Android home-screen app + desktop browsers).
 *
 * The opt-in is explicit: nothing here asks the browser for permission unless a
 * real tap reaches `enable()`, because Chrome on Android ignores prompts that
 * are not gesture-driven and an unsolicited prompt to a manager who never asked
 * for alerts is worse than no prompt at all.
 */

/** Where the id returned by the API is kept so this device can unsubscribe itself. */
const SUBSCRIPTION_ID_KEY = 'trackit:push-subscription-id';

export interface PushContextValue {
  /** Browser can do Web Push at all. */
  supported: boolean;
  /** Backend has VAPID keys configured. */
  serverEnabled: boolean;
  permission: NotificationPermission | 'unsupported';
  /** This device is opted in for the signed-in account. */
  registered: boolean;
  /** True while the mock API is in use: alerts are simulated in-page. */
  simulated: boolean;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendTest: () => Promise<void>;
  /** Sign-out: stop alerting every device of this account and clear the badge. */
  unregisterAll: () => Promise<void>;
}

const PushContext = createContext<PushContextValue | null>(null);

export function PushProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Browser capability never exists on the server, so the initial value already
  // differs between the two render passes. That is safe here: nothing this
  // provider renders depends on it (the toggle also needs `serverEnabled`, and
  // no API response exists on the first pass), and the first paint is identical.
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window === 'undefined' ? 'unsupported' : readPermission(),
  );
  const [local, setLocal] = useState<LocalPushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One silent re-registration per session per user; the SW can fire
  // `pushsubscriptionchange` repeatedly and a loop here would hammer the API.
  const resyncedFor = useRef<string | null>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.notifications.pushStatus,
    queryFn: getPushStatus,
    enabled: Boolean(user),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const serverEnabled = statusQuery.data?.enabled ?? false;
  const subscriptions = statusQuery.data?.subscriptions ?? [];

  /* The permission can also change outside this app (browser site settings). */
  useEffect(() => {
    let cancelled = false;
    void getLocalSubscription().then((subscription) => {
      if (!cancelled) setLocal(subscription);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLocal = useCallback(async () => {
    setLocal(await getLocalSubscription());
  }, []);

  const storeSubscriptionId = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return;
    if (id) window.localStorage.setItem(SUBSCRIPTION_ID_KEY, id);
    else window.localStorage.removeItem(SUBSCRIPTION_ID_KEY);
  }, []);

  /** Subscribes silently and hands the subscription to the backend. */
  const registerDevice = useCallback(
    async (applicationServerKey: string | null) => {
      const subscription = await subscribeToPush(applicationServerKey ?? '');
      const registered = await registerPushSubscription({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      });
      storeSubscriptionId(registered.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.pushStatus });
      return subscription;
    },
    [queryClient, storeSubscriptionId],
  );

  const enable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const decision = await requestPermission();
      setPermission(decision);
      if (decision !== 'granted') {
        setError(
          decision === 'unsupported'
            ? 'This browser cannot show notifications.'
            : 'Notifications are blocked. Allow them in the browser site settings first.',
        );
        return;
      }
      setLocal(await registerDevice(statusQuery.data?.applicationServerKey ?? null));
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }, [registerDevice, statusQuery.data]);

  const disable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const storedId =
        typeof window === 'undefined'
          ? null
          : window.localStorage.getItem(SUBSCRIPTION_ID_KEY);

      // Without the id this device cannot point at its own row, so every device
      // of the account is released rather than leaving an orphan behind.
      if (storedId) await removePushSubscription(storedId);
      else if (subscriptions.length > 0) await removeAllPushSubscriptions();
      storeSubscriptionId(null);

      await unsubscribeLocally();
      await refreshLocal();
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.pushStatus });
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }, [queryClient, refreshLocal, storeSubscriptionId, subscriptions.length]);

  const sendTest = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await sendTestPush();
      // The mock worker has no push handler, so the demo renders the alert here.
      if (env.useMockApi) {
        showLocalNotification(
          'TrackIt alerts are working',
          'Price, delivery, incident and stock alerts will appear here.',
        );
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const unregisterAll = useCallback(async () => {
    try {
      await removeAllPushSubscriptions();
    } catch {
      // Signing out must not fail because a device record could not be cleared.
    }
    storeSubscriptionId(null);
    try {
      await unsubscribeLocally();
    } catch {
      // Same: local cleanup is best-effort.
    }
    await syncAppBadge(0);
  }, [storeSubscriptionId]);

  /**
   * Silent re-arm after a page load or a rotated subscription: when the user has
   * already granted permission, subscribing needs no prompt, so the device
   * quietly re-registers (the API upserts on endpoint). This is what recovers
   * alerts after the browser expires a subscription.
   */
  const resync = useCallback(() => {
    if (!user || !serverEnabled) return Promise.resolve(null);
    if (getPermission() !== 'granted') return Promise.resolve(null);
    if (resyncedFor.current === user.id) return Promise.resolve(null);
    resyncedFor.current = user.id;

    const applicationServerKey = statusQuery.data?.applicationServerKey ?? null;
    // A subscription the browser still holds needs no new registration, only the
    // local echo; anything else goes through the API upsert.
    return getLocalSubscription()
      .then((existing) =>
        existing && subscriptions.length > 0 ? existing : registerDevice(applicationServerKey),
      )
      .catch(() => {
        // A failed silent re-arm leaves the explicit toggle as the way back in.
        return null;
      });
  }, [registerDevice, serverEnabled, statusQuery.data, subscriptions.length, user]);

  useEffect(() => {
    let cancelled = false;
    void resync().then((subscription) => {
      if (!cancelled && subscription) setLocal(subscription);
    });
    return () => {
      cancelled = true;
    };
  }, [resync]);

  /**
   * Messages from `public/sw.js`: it owns the tray notification and badge, but
   * only this page holds the access token, so anything needing an API call comes
   * back here.
   */
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'trackit:resubscribe') {
        resyncedFor.current = null;
        void resync().then((subscription) => {
          if (subscription) setLocal(subscription);
        });
        return;
      }
      if (data.type === 'trackit:navigate' && typeof data.url === 'string' && data.url.startsWith('/')) {
        router.push(data.url);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [resync, router]);

  const value = useMemo<PushContextValue>(
    () => ({
      supported: permission !== 'unsupported',
      serverEnabled,
      permission,
      registered: Boolean(local) && subscriptions.length > 0,
      simulated: env.useMockApi,
      busy,
      error,
      enable,
      disable,
      sendTest,
      unregisterAll,
    }),
    [busy, disable, enable, error, local, permission, sendTest, serverEnabled, subscriptions.length, unregisterAll],
  );

  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePush(): PushContextValue {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error('usePush must be used inside <PushProvider>.');
  return ctx;
}

function describe(err: unknown): string {
  if (isApiError(err)) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/** `unsupported` when the browser has no PushManager or service worker at all. */
function readPermission(): NotificationPermission | 'unsupported' {
  return isPushCapable() ? getPermission() : 'unsupported';
}
