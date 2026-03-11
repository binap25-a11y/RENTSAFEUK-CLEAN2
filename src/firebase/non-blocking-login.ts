'use client';

import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

/**
 * @fileOverview Consolidated Authentication Utilities.
 * Absolute source of truth for non-blocking auth actions.
 */

export function initiateAnonymousSignIn(auth: Auth): void {
  signInAnonymously(auth).catch((error) => {
    console.error('Anonymous sign-in failed:', error);
  });
}

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

export const initiateEmailSignUp = createUserNonBlocking;
export const initiateEmailSignIn = signInNonBlocking;
