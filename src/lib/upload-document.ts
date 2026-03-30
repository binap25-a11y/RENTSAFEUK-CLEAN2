'use client';

import { storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * @fileOverview Firebase Document Upload Library
 * Replaces Supabase to resolve storage connection errors and align with project tech stack.
 */

export const uploadPropertyDocument = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    // Path structure: documents/{userId}/{propertyId}/{fileName}
    const filePath = `documents/${userId}/${propertyId}/${fileName}`;

    const storageRef = ref(storage, filePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (err: any) {
    console.error('Firebase document upload failed:', err.message);
    throw new Error(`Upload failed: ${err.message}`);
  }
};
