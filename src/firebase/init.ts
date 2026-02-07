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
  // Reverted to explicit bucket URL to ensure a direct connection,
  // matching the configuration of the previously working test environment.
  const bucketUrl = `gs://${firebaseConfig.storageBucket}`;
  const storage = getStorage(firebaseApp, bucketUrl);

  return {
    firebaseApp,
    auth,
    firestore,
    storage,
  };
}
