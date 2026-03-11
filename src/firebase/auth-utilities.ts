'use client';

import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';

/**
 * @fileOverview Standardized Authentication Utilities.
 * Consolidates all login and signup logic to prevent module resolution conflicts.
 */

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
  onError?: (error: any) => void
): void {
  if (!auth) return;
  createUserWithEmailAndPassword(auth, email, password).catch((error) => {
    if (error && onError) onError(error);
  });
}

export function initiateAnonymousSignIn(auth: Auth): void {
  if (!auth) return;
  signInAnonymously(auth).catch((error) => {
    console.error('Anonymous sign-in failed:', error);
  });
}
