'use client';

/**
 * @fileOverview singular entry point for Firebase SDK initialization.
 * Prevents circular dependencies and ensures singleton instances across the app.
 */

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

let firebaseApp: FirebaseApp;

try {
  firebaseApp = getApps().length === 0 
    ? initializeApp(firebaseConfig) 
    : getApp();
} catch (e) {
  firebaseApp = getApp();
}

export const app = firebaseApp;
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

export function initializeFirebase() {
  return {
    firebaseApp: app,
    auth,
    firestore,
    storage
  };
}
