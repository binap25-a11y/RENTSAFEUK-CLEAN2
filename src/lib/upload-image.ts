'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image directly to Supabase Storage.
 * Ensures the file is stored in the 'Images' bucket under a structured path.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    // Generate a unique filename to prevent collisions
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Construct the structured path: userId/propertyId/filename
    const filePath = `${userId}/${propertyId}/${fileName}`;
    
    // Upload the binary file directly to Supabase
    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (error) {
      console.error('Supabase upload error:', error.message);
      // Re-throw with a hint about RLS policies which is the common cause of 'new row' errors
      throw new Error(`${error.message} (Hint: Check your 'Images' bucket RLS policies in Supabase)`);
    }

    // Retrieve the public URL for Firestore persistence
    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);
    
    return publicUrl;
  } catch (err: any) {
    console.error('Upload pipeline failure:', err.message);
    throw err;
  }
};
