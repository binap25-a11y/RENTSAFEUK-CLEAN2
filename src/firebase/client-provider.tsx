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
 * Ensures that the provider context is established before any children are rendered.
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

  // During initial mount or if services fail, we show a clean loading state.
  // CRITICAL: We do NOT render children here if services are missing, 
  // as children likely contain hooks that depend on the Firebase context.
  if (!isMounted || !firebaseServices) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Services...</p>
      </div>
    );
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
