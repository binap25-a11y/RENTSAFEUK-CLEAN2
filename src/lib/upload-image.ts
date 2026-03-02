'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeFirebase } from '@/firebase/init';

/**
 * Uploads a property image to Firebase Storage and returns the download URL.
 * Scoped to the user's specific directory for security.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string) => {
  const { storage } = initializeFirebase();
  if (!storage) throw new Error('Storage service not initialized');

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `images/${userId}/${propertyId}/${fileName}`;
  
  const storageRef = ref(storage, filePath);
  
  const uploadResult = await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(uploadResult.ref);

  return downloadUrl;
};
