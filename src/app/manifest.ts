import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RentSafeUK',
    short_name: 'RentSafeUK',
    description: 'UK Property Management & Compliance Portfolio Manager',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#2172F9',
    icons: [],
  }
}
