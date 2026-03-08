'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeFirebase } from '@/firebase/init';

/**
 * Uploads a property image to Firebase Storage.
 * Uses the project's native storage bucket, which is already configured
 * with appropriate security rules for the authenticated user.
 * This bypasses Supabase RLS issues by leveraging the app's primary backend.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    // Ensure Firebase is initialized
    const { storage } = initializeFirebase();
    
    // Generate a unique, collision-resistant filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Path structure: images/userId/propertyId/filename
    const storagePath = `images/${userId}/${propertyId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    console.log(`Initiating Firebase Storage sync: ${storagePath}`);

    // Perform the upload
    const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type
    });

    // Retrieve the public download URL
    const downloadUrl = await getDownloadURL(snapshot.ref);

    console.log(`Media synchronized. Resource URL: ${downloadUrl}`);
    return downloadUrl;
  } catch (err: any) {
    console.error('Firebase Storage critical failure:', err.message);
    throw new Error(`Upload failed: ${err.message}`);
  }
};
