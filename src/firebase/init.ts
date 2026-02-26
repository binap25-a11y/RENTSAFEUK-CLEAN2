'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * Initializes Firebase app and returns singleton instances of Auth, Firestore, and Storage.
 * Designed to be safe with Next.js hot reload / SSR.
 */
export function initializeFirebase() {
  const firebaseApp: FirebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  return getSdks(firebaseApp);
}

/**
 * Returns initialized Firebase services.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  const auth: Auth = getAuth(firebaseApp);
  const firestore: Firestore = getFirestore(firebaseApp);
  const storage: FirebaseStorage = getStorage(firebaseApp, firebaseConfig.storageBucket);

  return { firebaseApp, auth, firestore, storage };
}