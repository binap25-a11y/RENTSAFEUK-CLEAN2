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
  // Reverted to the standard getStorage() call for maximum reliability.
  // This allows the Firebase SDK to handle the connection details, which is more
  // robust once the CORS policy on the bucket is correctly configured.
  const storage = getStorage(firebaseApp);

  return {
    firebaseApp,
    auth,
    firestore,
    storage,
  };
}
