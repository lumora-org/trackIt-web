import type { MetadataRoute } from 'next';

/**
 * PWA web manifest (served at `/manifest.webmanifest` and linked automatically
 * by Next from this convention file). Enables Add to Home Screen on Android and
 * desktop installation in Chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'TrackIt — K.B.Y Global Investment',
    short_name: 'TrackIt',
    description: 'Multi-branch fuel station management for K.B.Y GLOBAL INVESTMENT.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#15803d',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
