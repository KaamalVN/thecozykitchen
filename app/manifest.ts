import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Cozy Kitchen',
    short_name: 'Cozy Kitchen',
    description: 'A warm, personal home-cooking recipe website showcasing dishes made at home, with love.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9f6f0',
    theme_color: '#4e6e58',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable' as any,
      },
    ],
  };
}
