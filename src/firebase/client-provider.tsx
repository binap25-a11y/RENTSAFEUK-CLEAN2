'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/init';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * A client-side component that initializes Firebase and provides it to its children.
 * This should be used at the root of your application layout (`app/layout.tsx`).
 * It ensures that Firebase is initialized only once when the application loads on the client.
 *
 * @param {FirebaseClientProviderProps} props The props for the component.
 * @returns {React.ReactElement} The provider component wrapping the children.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // useMemo is crucial here. It ensures that `initializeFirebase` is called
  // only once when the component mounts for the first time. Without it,
  // Firebase would be re-initialized on every render, leading to errors and
  // unnecessary connections.
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []); // The empty dependency array `[]` ensures this runs only once.

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
