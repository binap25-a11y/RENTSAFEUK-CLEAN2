'use client';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeFirebase } from '@/firebase/init';

/**
 * Uploads a property image to Firebase Storage.
 * Leverages the app's native storage rules and authentication.
 * Resolves Supabase RLS issues by using the integrated Firebase pipeline.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    const { storage } = initializeFirebase();
    
    // Generate a unique, collision-resistant filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Structure: images/{userId}/{propertyId}/{filename}
    // Matches standard storage.rules for user-isolated access
    const storagePath = `images/${userId}/${propertyId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    console.log(`Initiating media sync to Firebase Storage: ${storagePath}`);

    const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);

    console.log(`Media synchronized successfully. URL: ${downloadUrl}`);
    return downloadUrl;
  } catch (err: any) {
    console.error('Firebase Storage synchronization failed:', err.message);
    throw new Error(`Upload failed: ${err.message}`);
  }
};
