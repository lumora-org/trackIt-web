'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { configureApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { env } from '@/lib/env';

import { MockApiProvider } from './mock-api-provider';
import { AuthProvider } from './auth-provider';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // doc 05 §117 — current inventory must never be served from a stale cache.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          // Never retry client errors; they will not resolve on their own.
          if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        // PROMPT.md §17 — never retry a write automatically; that risks a
        // duplicate financial operation. Idempotency-Key handles safe retries.
        retry: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    configureApiClient({ baseUrl: env.apiBaseUrl });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MockApiProvider>
        <AuthProvider>{children}</AuthProvider>
      </MockApiProvider>
      {env.isDev ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
