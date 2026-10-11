'use client';

import { Bell, BellRing, Send } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/ui/states';
import { usePush } from '@/providers/push-provider';

/**
 * Explicit opt-in for Web Push alerts on this device.
 *
 * Rendered in the notification centre header, where wanting alerts is already
 * the context. Hidden entirely when the backend has no VAPID keys, so an
 * environment that cannot deliver push never shows a control that would fail.
 */
export function PushAlertsToggle() {
  const {
    supported,
    serverEnabled,
    permission,
    registered,
    simulated,
    busy,
    error,
    enable,
    disable,
    sendTest,
  } = usePush();

  if (!serverEnabled) return null;

  if (!supported) {
    return (
      <p className="text-sm text-neutral-500">
        Alerts need a browser that supports Web Push — Chrome or Edge, or the installed app on
        Android.
      </p>
    );
  }

  // Turning alerts on must stay a real user gesture: Chrome on Android suppresses
  // a permission prompt that is not tied to one.
  if (!registered) {
    const blocked = permission === 'denied';
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button
          variant={blocked ? 'ghost' : 'outline'}
          size="sm"
          loading={busy}
          loadingText="Enabling alerts"
          disabled={blocked}
          onClick={() => void enable()}
        >
          <Bell className="size-4" aria-hidden="true" />
          {blocked ? 'Alerts blocked' : 'Enable alerts'}
        </Button>
        {error ? <InlineError message={error} className="max-w-xs text-right" /> : null}
        <SimulatedNote simulated={simulated} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="ghost"
        size="sm"
        loading={busy}
        loadingText="Sending test"
        onClick={() => void sendTest()}
      >
        <Send className="size-4" aria-hidden="true" />
        Send a test alert
      </Button>
      <Button
        variant="outline"
        size="sm"
        loading={busy}
        loadingText="Turning off"
        onClick={() => void disable()}
      >
        <BellRing className="size-4" aria-hidden="true" />
        Alerts on
      </Button>
      {error ? <InlineError message={error} className="w-full" /> : null}
      <SimulatedNote simulated={simulated} />
    </div>
  );
}

/** The mock worker cannot receive push, so demo mode renders alerts in-page. */
function SimulatedNote({ simulated }: { simulated: boolean }) {
  if (!simulated) return null;
  return (
    <Badge tone="neutral" size="sm">
      Demo mode — alerts are simulated on this device
    </Badge>
  );
}
