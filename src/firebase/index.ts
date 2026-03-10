'use client';

/**
 * @fileOverview Standardized barrel file for Firebase services and utilities.
 * Stabilized exports to ensure unambiguous module resolution in Next.js builds.
 */

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Initializes the Firebase Client SDK.
 */
export function initializeFirebase() {
  const firebaseApp: FirebaseApp = getApps().length === 0 
    ? initializeApp(firebaseConfig) 
    : getApp();

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp)
  };
}

// Providers & Real-time Hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';

// Stable Authentication Utilities (Explicit extension mapping)
export {
  initiateAnonymousSignIn,
  createUserNonBlocking,
  signInNonBlocking,
  initiateEmailSignUp,
  initiateEmailSignIn,
} from './non-blocking-login.ts';

// Stable Data Mutation Utilities
export {
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from './non-blocking-updates.ts';

export * from './errors';
export * from './error-emitter';
