import { MetadataRoute } from 'next'

/**
 * Defines the PWA manifest for the application.
 * Updated to use RentSafeUK brand colors for consistent mobile installation.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RentSafeUK - Landlord Portfolio',
    short_name: 'RentSafeUK',
    description: 'Professional UK Property Management & Compliance Portfolio Manager',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F4F8F6',
    theme_color: '#A7D1AB',
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
