
'use client';

import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';

export type UserRole = 'landlord' | 'agent' | 'tenant';

export async function signInNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  onError?: (error: any) => void
): Promise<void> {
  if (!auth) return;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (onError) onError(error);
  }
}

export async function createUserNonBlocking(
  auth: Auth,
  email: string,
  password: string,
  role: UserRole,
  onError?: (error: any) => void
): Promise<void> {
  if (!auth) return;
  
  const normalizedEmail = email.toLowerCase().trim();
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const user = userCredential.user;
    const db = getFirestore();
    
    const profileData = {
      id: user.uid,
      email: normalizedEmail,
      role: role,
      createdAt: new Date().toISOString(),
      idleTimeoutMinutes: 30,
    };

    // Standardized 'users' root collection
    await setDoc(doc(db, 'users', user.uid), profileData);
    
    const defaultName = role.charAt(0).toUpperCase() + role.slice(1);
    await updateProfile(user, { displayName: defaultName });
  } catch (error) {
    if (onError) onError(error);
  }
}

export function initiateAnonymousSignIn(auth: Auth): void {
  if (!auth) return;
  signInAnonymously(auth).catch((error) => {
    console.error('Anonymous sign-in failed:', error);
  });
}
