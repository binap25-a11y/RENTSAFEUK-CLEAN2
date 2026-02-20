import { MetadataRoute } from 'next'

/**
 * Defines the PWA manifest for the application.
 * Using manifest.ts provides a dynamic and robust way to handle PWA metadata in Next.js 15.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RentSafeUK - Landlord Portfolio',
    short_name: 'RentSafeUK',
    description: 'Professional UK Property Management & Compliance Portfolio Manager',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#2172F9',
    icons: [
      {
        src: 'https://picsum.photos/seed/rentsafe-pwa-192/192/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://picsum.photos/seed/rentsafe-pwa-512/512/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
