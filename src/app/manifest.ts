import { MetadataRoute } from 'next'

/**
 * Defines the PWA manifest for the application.
 * Stabilized to use exact RentSafeUK brand colors (#A7D1AB) for icons
 * to ensure consistency across mobile installations.
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
        src: 'https://placehold.co/192x192/A7D1AB/12310A/png?text=RS',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://placehold.co/512x512/A7D1AB/12310A/png?text=RentSafeUK',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
