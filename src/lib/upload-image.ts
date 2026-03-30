'use client';

import { storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * @fileOverview Firebase Image Upload Library
 * Replaces Supabase to resolve "Failed to fetch" errors and unify storage on Firebase.
 */

export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    // Path structure: images/{userId}/{propertyId}/{fileName}
    const filePath = `images/${userId}/${propertyId}/${fileName}`;

    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (err: any) {
    console.error('Firebase image upload failed:', err.message);
    throw new Error(`Upload failed: ${err.message}`);
  }
};
