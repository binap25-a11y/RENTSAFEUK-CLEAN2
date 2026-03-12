'use client';

/**
 * @fileOverview Main Firebase Initialization Entry Point.
 * Re-exports from stable modules to ensure reliable module resolution.
 */

// 1. Core Authentication Utilities
export { 
  signInNonBlocking, 
  createUserNonBlocking, 
  initiateAnonymousSignIn,
  type UserRole
} from './auth-utilities';

// 2. Core Firestore Mutation Utilities
export {
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from './firestore-utilities';

// 3. Error Handling Architecture
export * from './errors';
export * from './error-emitter';

// 4. Firebase App Initialization
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

// 5. Provider Hooks
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
