import type { Metadata, Viewport } from 'next';

import { Providers } from '@/providers/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TrackIt',
    template: '%s | TrackIt',
  },
  description: 'Multi-branch fuel station management for K.B.Y GLOBAL INVESTMENT.',
  applicationName: 'TrackIt',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is intentionally NOT disabled (PROMPT.md §26 accessibility).
  themeColor: '#15803d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="bg-brand-700 sr-only text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
