'use client';

import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

/**
 * Creates a user with email and password without blocking the main thread.
 * Success is handled by the global onAuthStateChanged listener.
 * Errors are passed to the provided callback.
 *
 * @param auth The Firebase Auth instance.
 * @param email The user's email.
 * @param password The user's password.
 * @param onError A callback function to handle any errors.
 */
export function createUserNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  onError: (error: any) => void
) {
  createUserWithEmailAndPassword(auth, email, password)
    .catch((error) => {
      // The calling component is responsible for handling the UI update.
      onError(error);
    });
  // No .then() needed here. The onAuthStateChanged listener will handle success.
}

/**
 * Signs in a user with email and password without blocking the main thread.
 * Success is handled by the global onAuthStateChanged listener.
 * Errors are passed to the provided callback.
 *
 * @param auth The Firebase Auth instance.
 * @param email The user's email.
 * @param password The user's password.
 * @param onError A callback function to handle any errors.
 */
export function signInNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  onError: (error: any) => void
) {
  signInWithEmailAndPassword(auth, email, password)
    .catch((error) => {
      // The calling component is responsible for handling the UI update.
      onError(error);
    });
  // No .then() needed here. The onAuthStateChanged listener will handle success.
}
