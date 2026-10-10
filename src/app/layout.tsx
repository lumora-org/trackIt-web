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
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TrackIt',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is intentionally NOT disabled (PROMPT.md §26 accessibility).
  // `viewport-fit=cover` lets the installed PWA extend into display cutouts so
  // the `safe-top` / `safe-bottom` padding utilities resolve to real insets.
  viewportFit: 'cover',
  themeColor: '#15803d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
         * Applies the stored theme before first paint so there is no flash of
         * the wrong scheme. Kept dependency-free deliberately.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('trackit-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()",
          }}
        />
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
