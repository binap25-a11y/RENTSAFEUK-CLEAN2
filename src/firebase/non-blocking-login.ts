'use client';

import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';

/**
 * @fileOverview Stable Authentication Utilities.
 * Consolidated logic to ensure runtime identification and consistent exports.
 */

export function signInNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  onError?: (error: any) => void
): void {
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
  createUserWithEmailAndPassword(auth, email, password).catch((error) => {
    if (error && onError) onError(error);
  });
}

export function initiateAnonymousSignIn(auth: Auth): void {
  signInAnonymously(auth).catch((error) => {
    console.error('Anonymous sign-in failed:', error);
  });
}

export const initiateEmailSignUp = createUserNonBlocking;
export const initiateEmailSignIn = signInNonBlocking;
