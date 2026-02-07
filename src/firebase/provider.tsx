'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { Storage } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from './error-emitter';
import { FirestorePermissionError } from './errors';


// This component is defined here to avoid circular dependencies
function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      setError(error);
    };
    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  if (error) {
    throw error;
  }
  return null;
}

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: Storage;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Defines the shape of the data stored in the Firebase context.
 * This is the central point for accessing all Firebase services and user state.
 */
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  storage: Storage | null;
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

/**
 * Defines the return type for the `useFirebase()` hook.
 * It guarantees that all services are non-null when accessed through this hook.
 */
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: Storage;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

/**
 * Defines the return type for the `useUser()` hook, focusing only on auth state.
 */
export interface UserHookResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Create the React Context for Firebase services.
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider is a React component that manages and provides Firebase services
 * and the user's authentication state to the entire application.
 * It also handles the logic for creating a user profile document in Firestore on first sign-in.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start in a loading state until the first auth check completes.
    userError: null,
  });
  const { toast } = useToast();

  // Effect to subscribe to Firebase auth state changes.
  useEffect(() => {
    if (!auth) {
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    // Handles the redirect result from an OAuth provider like Google after the user returns to the app.
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
            toast({
                title: "Signed in successfully",
                description: `Welcome, ${result.user.displayName || result.user.email}!`,
            });
        }
      })
      .catch((error) => {
        console.error("Error processing redirect result:", error);
        toast({
            variant: "destructive",
            title: "Sign-in failed",
            description: "Could not complete sign-in. Please try again.",
        });
    });

    // `onAuthStateChanged` is the core listener for authentication state.
    // It fires on sign-in, sign-out, and when the user's token is refreshed.
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser && firestore) {
          // If a user is logged in, check if their profile exists in Firestore.
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (!userDocSnap.exists()) {
            // This is a first-time sign-in. Create the user profile document.
            try {
              await setDoc(userDocRef, {
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || firebaseUser.email,
                createdAt: serverTimestamp(),
              });
            } catch (createError) {
              console.error("FirebaseProvider: Error creating user document:", createError);
            }
          }
        }
        // Update the global state with the user and set loading to false.
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
      },
      (error) => { // Handle errors from the auth listener itself.
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    // Unsubscribe from the listener when the component unmounts.
    return () => unsubscribe();
  }, [auth, firestore, toast]);

  // Memoize the context value to prevent unnecessary re-renders of consuming components.
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && storage);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      storage: servicesAvailable ? storage : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, storage, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};


/**
 * A custom hook to safely access all core Firebase services and user authentication state.
 * It ensures that it's used within a FirebaseProvider and that services are available.
 * @throws {Error} If used outside of a FirebaseProvider or if services are missing.
 * @returns {FirebaseServicesAndUser} An object containing all Firebase services and user state.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.storage) {
    throw new Error('Firebase core services not available. Check that FirebaseProvider is receiving all required props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    storage: context.storage,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** A convenience hook to directly access the Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** A convenience hook to directly access the Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** A convenience hook to directly access the Firebase Storage instance. */
export const useStorage = (): Storage => {
  const { storage } = useFirebase();
  return storage;
};

/** A convenience hook to directly access the Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

// Internal type for the useMemoFirebase hook.
type MemoFirebase <T> = T & {__memo?: boolean};

/**
 * A specialized `useMemo` hook for creating stable Firebase Query or DocumentReference objects.
 * This is CRITICAL for preventing infinite loops in `useCollection` and `useDoc` hooks.
 * @param factory A function that returns a Firestore Query or DocumentReference.
 * @param deps The dependency array for the memoization.
 * @returns The memoized Firebase reference.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  // This tag is for internal use by hooks like useCollection to verify memoization.
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * A hook specifically for accessing the authenticated user's state.
 * This is the recommended hook for checking if a user is logged in.
 * @returns {UserHookResult} An object with the user, loading status, and any auth errors.
 */
export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useFirebase(); // Leverages the main hook for its state.
  return { user, isUserLoading, userError };
};
