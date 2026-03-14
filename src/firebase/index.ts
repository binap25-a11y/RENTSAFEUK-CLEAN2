
'use client';

/**
 * @fileOverview Consolidated Firebase SDK Registry
 * Decoupled from core initialization to prevent circular dependencies.
 */

export { firebaseApp, auth, firestore, storage, initializeFirebase } from './init';
export { FirebaseProvider, useFirebase, useAuth, useFirestore, useFirebaseApp, useMemoFirebase, useUser } from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { 
  setDocumentNonBlocking, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from './firestore-utilities';
export { 
  signInNonBlocking, 
  createUserNonBlocking, 
  initiateAnonymousSignIn,
  type UserRole 
} from './auth-utilities';
export { FirestorePermissionError } from './errors';
export { errorEmitter } from './error-emitter';
