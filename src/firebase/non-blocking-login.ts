
'use client';

import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

/**
 * Initiate anonymous sign-in (non-blocking).
 */
export function initiateAnonymousSignIn(auth: Auth): void {
  signInAnonymously(auth).catch((error) => {
    console.error('Anonymous sign-in failed:', error);
  });
}

/**
 * Initiate email/password sign-up (non-blocking).
 */
export function createUserNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  onError?: (error: any) => void
): void {
  createUserWithEmailAndPassword(auth, email, password).catch((error) => {
    if (onError) onError(error);
  });
}

/**
 * Initiate email/password sign-in (non-blocking).
 */
export function signInNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  onError?: (error: any) => void
): void {
  signInWithEmailAndPassword(auth, email, password).catch((error) => {
    if (onError) onError(error);
  });
}

// Aliases for compatibility
export const initiateEmailSignUp = createUserNonBlocking;
export const initiateEmailSignIn = signInNonBlocking;
