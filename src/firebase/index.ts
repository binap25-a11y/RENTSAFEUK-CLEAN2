'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

let emulatorsConnected = false;

export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  const storage = firebaseConfig.storageBucket
    ? getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`)
    : getStorage(firebaseApp);

  if (process.env.NODE_ENV !== 'production' && !emulatorsConnected) {
    try {
      // Note: As of firebase@11.9.1, connectAuthEmulator throws an error if called multiple times.
      // This can happen with React StrictMode or HMR. The try/catch block handles this gracefully.
      connectAuthEmulator(auth, 'http://localhost:9099');
      connectFirestoreEmulator(firestore, 'localhost', 8080);
      if (firebaseConfig.storageBucket) {
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      emulatorsConnected = true;
      console.log("Successfully connected to Firebase emulators.");
    } catch (e: any) {
      // If the error indicates it's already connected, we can ignore it.
      // This is a common occurrence during development with hot-reloading.
      if (!e.message.includes('already connected')) {
         console.error("Error connecting to Firebase emulators. Please ensure they are running.", e);
      }
    }
  }

  return {
    firebaseApp,
    auth,
    firestore,
    storage,
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
