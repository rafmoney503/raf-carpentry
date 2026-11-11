import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HQ · Rafal Solutions',
    short_name: 'HQ',
    description: 'Every app’s numbers in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f3f2ee',
    theme_color: '#f3f2ee',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
