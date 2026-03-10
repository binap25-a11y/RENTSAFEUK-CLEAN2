'use client';

import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

/**
 * @fileOverview Core authentication utilities implemented as non-blocking functions.
 * Consolidated into a stable TypeScript implementation to resolve resolution ambiguity.
 */

/**
 * Initiate anonymous sign-in (non-blocking).
 * @param auth The Firebase Auth instance.
 */
export function initiateAnonymousSignIn(auth: Auth): void {
  signInAnonymously(auth).catch((error) => {
    console.error('Anonymous sign-in failed:', error);
  });
}

/**
 * Initiate email/password sign-up (non-blocking).
 * @param auth The Firebase Auth instance.
 * @param email The user's email address.
 * @param password The user's password.
 * @param onError Optional callback for error handling.
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
 * @param auth The Firebase Auth instance.
 * @param email The user's email address.
 * @param password The user's password.
 * @param onError Optional callback for error handling.
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

// Aliases for broad compatibility across the application
export const initiateEmailSignUp = createUserNonBlocking;
export const initiateEmailSignIn = signInNonBlocking;
