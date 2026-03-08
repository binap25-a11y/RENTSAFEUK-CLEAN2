'use client';

import React, { useMemo, useEffect, useState, type ReactNode } from 'react';
import { FirebaseProvider } from './provider';
import { initializeFirebase } from './init';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Client-side provider that handles the one-time initialization of Firebase services.
 * Resolves context errors by ensuring children are only rendered after the Provider is active.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const firebaseServices = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      return initializeFirebase();
    } catch (e) {
      console.error("Firebase SDK Initialization Error:", e);
      return null;
    }
  }, []);

  // During initial mount, we show a clean loading state.
  // We MUST NOT render {children} here because they likely contain hooks 
  // that depend on the FirebaseContext which is provided below.
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
      </div>
    );
  }

  // If initialization fails for some catastrophic reason, we render children 
  // as a fallback, but the app will likely show its own internal error states.
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
