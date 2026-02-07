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
  // Explicitly connect to the storage bucket from the config.
  // This is a more direct and reliable method that was used when the test page worked.
  const storage = getStorage(firebaseApp, `gs://${firebaseConfig.storageBucket}`);

  return {
    firebaseApp,
    auth,
    firestore,
    storage,
  };
}
