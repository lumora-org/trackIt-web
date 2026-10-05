import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { configureApiClient } from '@/api/client';

// Deterministic timezone so currency/date formatting assertions are stable.
// Nigeria is UTC+1 year-round (WAT); docs render timestamps in local time.
process.env.TZ = 'Africa/Lagos';

beforeAll(() => {
  // MSW serves `/api/v1/*` on the page's own origin, so tests must use a
  // relative base URL. `env.apiBaseUrl` already does this in mock mode.
  configureApiClient({ baseUrl: '' });

  // Failing loudly on an unhandled request stops a test from silently passing
  // against a handler that does not exist. (MSW v3 renamed this to `onUnhandledFrame`.)
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});

// jsdom does not implement matchMedia, which responsive components rely on.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});
