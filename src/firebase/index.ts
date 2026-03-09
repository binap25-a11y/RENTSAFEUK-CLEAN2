
'use client';

/**
 * @fileOverview Consolidated barrel file for Firebase services and utilities.
 * Resolves build ambiguity by standardizing on stable TypeScript exports.
 */

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Initializes the Firebase Client SDK.
 * Ensures services are only initialized once on the client.
 */
export function initializeFirebase() {
  if (!getApps().length) {
    let firebaseApp;
    try {
      firebaseApp = initializeApp(firebaseConfig);
    } catch (e) {
      console.warn('Firebase initialization warning:', e);
      firebaseApp = initializeApp(firebaseConfig);
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

// Providers & Components
export * from './provider';
export * from './client-provider';

// Firestore Hooks
export * from './firestore/use-collection';
export * from './firestore/use-doc';

// Authentication Utilities
export * from './non-blocking-login';

// Data Mutation Utilities
export * from './non-blocking-updates';

// Global Error Handling
export * from './errors';
export * from './error-emitter';
