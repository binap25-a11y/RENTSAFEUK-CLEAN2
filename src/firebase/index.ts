'use client';

/**
 * @fileOverview Standardized barrel file for Firebase services and utilities.
 * Consolidated to resolve build-time resolution ambiguity and export errors.
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

  return getSdks(firebaseApp);
}

/**
 * Returns initialized Firebase client-side services.
 */
export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
    storage: getStorage(firebaseApp)
  };
}

// Providers & Hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';

// Utility Exports
export { 
  initiateAnonymousSignIn, 
  createUserNonBlocking, 
  signInNonBlocking,
  initiateEmailSignUp,
  initiateEmailSignIn 
} from './non-blocking-login';

export { 
  setDocumentNonBlocking, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from './non-blocking-updates';

export * from './errors';
export * from './error-emitter';
