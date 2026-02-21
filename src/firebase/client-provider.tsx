
'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/init';
import { firebaseConfig } from '@/firebase/config';

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
  const firebaseServices = useMemo(() => {
    // A simple check to see if the config has been filled out.
    // This is NOT a security check, just a check for placeholder values.
    const isFirebaseConfigured = firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE');

    if (!isFirebaseConfigured) {
        // Return null services if not configured, preventing a crash.
        // The UI will handle showing a configuration message.
        return { firebaseApp: null, auth: null, firestore: null, storage: null };
    }
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
    