'use client';

import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';

/**
 * @fileOverview Standardized Authentication Utilities.
 * Consolidates login and signup logic with automatic Firestore profile initialization.
 */

export type UserRole = 'landlord' | 'agent' | 'tenant';

export function signInNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  onError?: (error: any) => void
): void {
  if (!auth) return;
  signInWithEmailAndPassword(auth, email, password).catch((error) => {
    if (error && onError) onError(error);
  });
}

export function createUserNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  role: UserRole,
  onError?: (error: any) => void
): void {
  if (!auth) return;
  
  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;
      const db = getFirestore();
      
      // Initialize the user profile document immediately
      // This is the source of truth for routing logic
      const profileData = {
        id: user.uid,
        email: email.toLowerCase().trim(),
        role: role,
        createdAt: new Date().toISOString(),
        idleTimeoutMinutes: 30,
      };

      await setDoc(doc(db, 'userProfiles', user.uid), profileData);
      
      // Set a default display name based on role
      const defaultName = role.charAt(0).toUpperCase() + role.slice(1);
      await updateProfile(user, { displayName: defaultName });
    })
    .catch((error) => {
      if (error && onError) onError(error);
    });
}

export function initiateAnonymousSignIn(auth: Auth): void {
  if (!auth) return;
  signInAnonymously(auth).catch((error) => {
    console.error('Anonymous sign-in failed:', error);
  });
}
