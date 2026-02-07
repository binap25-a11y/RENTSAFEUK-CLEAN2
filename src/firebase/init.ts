'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Initializes the Firebase application and its services.
 * This function is designed to be called once on the client-side.
 * It ensures that Firebase is not re-initialized on every render,
 * which is a common source of errors.
 *
 * @returns An object containing the initialized Firebase services.
 */
export function initializeFirebase() {
  // Check if a Firebase app has already been initialized.
  // This is the standard pattern for Next.js to prevent re-initialization on hot reloads.
  if (!getApps().length) {
    // ALWAYS initialize with the explicit config to ensure consistency.
    // This removes the ambiguity of automatic initialization from environment variables.
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App.
  return getSdks(getApp());
}

/**
 * Retrieves the singleton instances of Firebase services for the given app.
 *
 * @param firebaseApp The initialized FirebaseApp instance.
 * @returns An object with the Auth, Firestore, and Storage SDKs.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  // Explicitly connect to the storage bucket using its URL.
  // This removes any ambiguity and ensures the SDK connects to the correct bucket,
  // which can resolve persistent timeout issues related to CORS or network configuration.
  const storage = getStorage(firebaseApp, firebaseConfig.storageBucket);

  return {
    firebaseApp,
    auth,
    firestore,
    storage,
  };
}
