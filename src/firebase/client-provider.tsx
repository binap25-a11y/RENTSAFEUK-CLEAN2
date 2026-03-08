'use client';

import React, { useMemo, useEffect, useState, type ReactNode } from 'react';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './init';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Client-side provider that handles the one-time initialization of Firebase services.
 * Implements a mounting check to prevent hydration mismatches and ChunkLoadErrors 
 * during the initial boot sequence in development environments.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const firebaseServices = useMemo(() => {
    // Only initialize on the client after mounting to ensure 
    // the environment is fully ready.
    if (typeof window === 'undefined') return null;
    return initializeFirebase();
  }, []);

  // During SSR and initial hydration, we render the children directly.
  // Once mounted on the client, we wrap them in the provider.
  if (!isMounted || !firebaseServices) {
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
