'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * RentSafeUK Primary SDK Initialization.
 * Centralized here to prevent circular dependencies in the barrel file.
 */
let app: FirebaseApp;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (e) {
  app = getApp();
}

export const firebaseApp = app;
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

export function initializeFirebase() {
  return {
    firebaseApp,
    auth,
    firestore,
    storage
  };
}
