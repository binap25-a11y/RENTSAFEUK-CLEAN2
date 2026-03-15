import { MetadataRoute } from 'next'

/**
 * Defines the PWA manifest for the application.
 * Stabilized to use exact RentSafeUK brand colors (#A7D1AB) for icons
 * and high-contrast white text to ensure visibility on mobile home screens.
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
        src: 'https://placehold.co/192x192/A7D1AB/ffffff/png?text=RS',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://placehold.co/512x512/A7D1AB/ffffff/png?text=RentSafeUK',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
