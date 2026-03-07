'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage.
 * This function uses the client SDK to perform direct binary uploads to the 'Images' bucket.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file || !supabase) return '';

  try {
    // Generate a unique filename to prevent collisions
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Path: userId/propertyId/filename
    const filePath = `${userId}/${propertyId}/${fileName}`;

    // Perform the upload to the 'Images' bucket
    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (error) {
      console.error('Supabase upload error:', error.message);
      // provide a helpful hint for the RLS policy issue
      throw new Error(`${error.message} (Hint: Ensure your 'Images' bucket RLS policy for INSERT uses CHECK (bucket_id = 'Images') for the 'anon' role)`);
    }

    // Retrieve the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err: any) {
    console.error('Upload pipeline failure:', err.message);
    throw err;
  }
};
