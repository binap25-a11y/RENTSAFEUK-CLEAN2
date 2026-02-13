import { MetadataRoute } from 'next'

/**
 * Defines the PWA manifest for the application.
 * This function returns a dynamic manifest object. 
 * Ensure that no static manifest.json or manifest.webmanifest exists in the same directory to avoid conflicts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RentSafeUK - Landlord Portfolio',
    short_name: 'RentSafeUK',
    description: 'UK Property Management & Compliance Portfolio Manager',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFFFF',
    theme_color: '#2172F9',
    icons: [
      {
        src: 'https://picsum.photos/seed/rentsafe-icon-192/192/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://picsum.photos/seed/rentsafe-icon-512/512/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}