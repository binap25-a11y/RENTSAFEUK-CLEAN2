'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // ALWAYS initialize with the explicit config to ensure consistency.
    // This removes the ambiguity of automatic initialization.
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  // To resolve the persistent connection timeout, we are switching to an explicit
  // bucket URL. This ensures the SDK connects directly to the specified bucket,
  // eliminating any ambiguity that might cause network retries to fail.
  const storage = getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`);

  return {
    firebaseApp,
    auth,
    firestore,
    storage,
  };
}
