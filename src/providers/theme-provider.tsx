'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
  useSyncExternalStore,
} from 'react';

/**
 * Light/dark theme state (PROMPT.md §26 — respect user preference).
 *
 * The preference is an external store: it persists in localStorage, defaults to
 * following the OS, and is read via `useSyncExternalStore` so server HTML and
 * hydration always agree (the server snapshot is the light/system default).
 * `src/app/layout.tsx` runs a tiny inline script that applies the same rule
 * before first paint, so there is never a flash of the wrong scheme.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'trackit-theme';

type Listener = () => void;

/* ---------------------------------------------------------- external store */

let preference: ThemePreference = 'system';
const listeners = new Set<Listener>();

// Adopt the stored choice once per session. Guarded so server imports are a
// no-op; the inline script in the root layout keeps the DOM correct meanwhile.
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') preference = stored;
  } catch {
    // Storage unavailable (private mode) — keep following the OS.
  }
}

function getSnapshot(): ThemePreference {
  return preference;
}

function getServerSnapshot(): ThemePreference {
  return 'system';
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getServerSystemTheme(): 'light' | 'dark' {
  return 'light';
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  // The *resolved* theme also changes when the OS setting flips while the
  // user is following the system.
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', listener);
  };
}

function setPreference(next: ThemePreference): void {
  preference = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Persisting is best-effort; the session still switches.
  }
  for (const listener of listeners) listener();
}

/* --------------------------------------------------------------- context */

interface ThemeContextValue {
  /** What the user picked; `system` follows the OS setting. */
  theme: ThemePreference;
  /** The theme actually in effect right now. */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
  /** Pin the opposite of the currently applied theme. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const systemTheme = useSyncExternalStore(subscribe, getSystemTheme, getServerSystemTheme);
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  // Keep the <html> class in sync — the DOM is the external system here; the
  // no-flash script has usually applied this value long before this effect.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: setPreference,
      toggleTheme: () => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark'),
    }),
    [theme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}
