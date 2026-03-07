'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeFirebase } from '@/firebase/init';

/**
 * Uploads a property image to Firebase Storage.
 * This is used as a robust alternative to Supabase to bypass RLS policy restrictions 
 * that often block anonymous binary synchronization in development environments.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    const { storage } = initializeFirebase();
    
    // Generate a unique filename to prevent collisions
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Use the path defined in your storage.rules: images/{userId}/{allPaths=**}
    const filePath = `images/${userId}/${propertyId}/${fileName}`;
    const storageRef = ref(storage, filePath);
    
    // Upload the binary file directly
    const snapshot = await uploadBytes(storageRef, file);
    
    // Retrieve the permanent public URL for Firestore persistence
    const downloadUrl = await getDownloadURL(snapshot.ref);
    
    return downloadUrl;
  } catch (err: any) {
    console.error('Media synchronization failure:', err.message);
    throw new Error(`Upload failed: ${err.message}. Ensure your Firebase Storage bucket is initialized.`);
  }
};
