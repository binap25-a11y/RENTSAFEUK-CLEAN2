'use client';

/**
 * @fileOverview Main Firebase Initialization Entry Point.
 * Optimized export structure to resolve module resolution conflicts and ensure function availability.
 */

// 1. Explicitly export authentication utilities
export { 
  signInNonBlocking, 
  createUserNonBlocking, 
  initiateAnonymousSignIn 
} from './auth-utilities';

// 2. Explicitly export firestore utilities
export {
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from './firestore-utilities';

export * from './errors';
export * from './error-emitter';

// 3. Firebase App Initialization
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    try {
      firebaseApp = initializeApp(firebaseConfig);
    } catch (e) {
      firebaseApp = initializeApp();
    }
    return getSdks(firebaseApp);
  }
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

// 4. Export hooks and providers
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
