'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * @fileOverview Main Firebase Initialization Entry Point.
 * Optimized to ensure explicit exports from stable source modules.
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

// Authentication Utilities (Explicit exports to avoid resolution shadowing)
import { signInNonBlocking, createUserNonBlocking, initiateAnonymousSignIn } from './non-blocking-login';
export { signInNonBlocking, createUserNonBlocking, initiateAnonymousSignIn };

// Database Utilities
export * from './non-blocking-updates';

export * from './errors';
export * from './error-emitter';
