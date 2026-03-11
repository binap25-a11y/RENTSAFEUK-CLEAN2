'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * @fileOverview Main Firebase Initialization Entry Point.
 * Consolidated to resolve module resolution conflicts and circular dependencies.
 */

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

// Core Providers & Hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';

// Stable Exports from logic modules
export { 
  signInNonBlocking, 
  createUserNonBlocking, 
  initiateAnonymousSignIn,
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
