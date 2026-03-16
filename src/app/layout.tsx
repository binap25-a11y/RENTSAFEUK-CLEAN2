import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';

/**
 * @fileOverview Root Layout for RentSafeUK
 * Explicitly configures brand-aligned metadata for PWA and mobile installs.
 * Brand Color: #A7D1AB (Soft Green)
 */

export const metadata: Metadata = {
  title: 'RentSafeUK',
  description: 'Professional UK Property Management & Portfolio Audit Trail',
  applicationName: 'RentSafeUK',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RentSafeUK',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: 'https://placehold.co/32x32/A7D1AB/ffffff/png?text=RS', sizes: '32x32' },
      { url: 'https://placehold.co/192x192/A7D1AB/ffffff/png?text=RentSafeUK', sizes: '192x192' },
    ],
    apple: [
      { url: 'https://placehold.co/180x180/A7D1AB/ffffff/png?text=RentSafeUK', sizes: '180x180' },
    ],
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#A7D1AB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>{children}</FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
