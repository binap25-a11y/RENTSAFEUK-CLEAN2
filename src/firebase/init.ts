'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * Robust Firebase initialization for Next.js environments.
 * Ensures services are only initialized once.
 */
export function initializeFirebase() {
  const firebaseApp: FirebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  return getSdks(firebaseApp);
}

/**
 * Returns initialized Firebase client-side services.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  const auth: Auth = getAuth(firebaseApp);
  const firestore: Firestore = getFirestore(firebaseApp);
  const storage: FirebaseStorage = getStorage(firebaseApp);

  return { firebaseApp, auth, firestore, storage };
}
