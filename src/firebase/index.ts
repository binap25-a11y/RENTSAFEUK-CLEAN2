'use client';

/**
 * Main Firebase Entry Point (Barrel File)
 * Re-exports core functionality, hooks, and initialization logic.
 */

export * from './init';
export * from './provider';
export { FirebaseClientProvider } from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
