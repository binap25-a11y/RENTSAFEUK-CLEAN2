'use client';

import React, { useMemo, useEffect, useState, type ReactNode } from 'react';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './init';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Client-side provider that handles the one-time initialization of Firebase services.
 * Implements a strict mounting check to resolve Runtime ChunkLoadErrors and 
 * hydration mismatches in proxied cloud development environments.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Confirm client-side mount to prevent double-initialization issues
    setIsMounted(true);
  }, []);

  const firebaseServices = useMemo(() => {
    // Only initialize on the client after mounting to ensure 
    // the environment is fully ready and stable.
    if (typeof window === 'undefined') return null;
    try {
      return initializeFirebase();
    } catch (e) {
      console.error("Firebase SDK Initialization Error:", e);
      return null;
    }
  }, []);

  // During SSR and initial hydration, we render a stable wrapper to keep
  // the DOM tree consistent and prevent Webpack chunk timeouts.
  if (!isMounted) {
    return <div className="min-h-screen bg-background" aria-hidden="true">{children}</div>;
  }

  if (!firebaseServices) {
    return <>{children}</>;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
