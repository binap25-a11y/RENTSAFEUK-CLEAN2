'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeFirebase } from '@/firebase/init';

/**
 * Uploads a property image directly to Firebase Storage.
 * This replaces the Supabase pipeline which was hitting RLS policy issues.
 * This method is more reliable as it uses the authenticated Firebase session.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    // Initialize storage via the central Firebase initialization logic
    const { storage } = initializeFirebase();
    
    // Generate a unique filename to prevent collisions
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Construct the structured path used in storage.rules
    const filePath = `images/${userId}/${propertyId}/${fileName}`;
    
    const storageRef = ref(storage, filePath);
    
    // Upload the binary file directly from the browser
    const snapshot = await uploadBytes(storageRef, file);
    
    // Retrieve the public download URL for Firestore persistence
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (err: any) {
    console.error('Firebase Storage synchronization failure:', err.message);
    throw new Error(`Media upload failed: ${err.message}`);
  }
};
