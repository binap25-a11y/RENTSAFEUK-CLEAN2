'use client';

/**
 * @fileOverview Standardized barrel file for Firebase services and utilities.
 */

export * from './init';
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';

export {
  initiateAnonymousSignIn,
  createUserNonBlocking,
  signInNonBlocking,
  initiateEmailSignUp,
  initiateEmailSignIn,
} from './non-blocking-login';

export {
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from './non-blocking-updates';

export * from './errors';
export * from './error-emitter';
