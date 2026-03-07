'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeFirebase } from '@/firebase';

/**
 * Uploads a property image to Firebase Storage.
 * This resolves the "new row violates row-level security policy" error seen with Supabase
 * by leveraging the application's native Firebase infrastructure and security rules.
 * Throws errors so the calling component can handle UI notifications.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';
  
  console.log(`Initiating secure media synchronization for property ${propertyId}...`);
  
  try {
    const { storage } = initializeFirebase();
    
    // Organize storage path following the pattern in storage.rules (images/{userId}/{allPaths=**})
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `images/${userId}/${propertyId}/${fileName}`;
    
    const storageRef = ref(storage, filePath);
    
    // Perform upload with appropriate metadata
    const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg'
    });
    
    // Get absolute public URL for storage in Firestore
    const downloadUrl = await getDownloadURL(snapshot.ref);
    
    console.log(`Media synchronized successfully via Firebase Storage. URL: ${downloadUrl}`);
    return downloadUrl;
  } catch (err: any) {
    console.error('Storage synchronization pipeline failure:', err.message);
    // Provide a user-friendly error if it's a known storage error
    if (err.code === 'storage/unauthorized') {
        throw new Error("Permission denied. Ensure you are logged in and authorized to update this property.");
    }
    throw err;
  }
};
