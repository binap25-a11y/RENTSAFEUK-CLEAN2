'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage.
 * This function uses the client SDK to perform direct binary uploads to the 'Images' bucket.
 * 
 * IMPORTANT: To prevent "new row violates row-level security policy" errors,
 * ensure your 'Images' bucket has an INSERT policy for the 'anon' or 'public' role
 * with the check expression: (bucket_id = 'Images')
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file || !supabase) {
    console.warn("Upload execution skipped: Missing file or Supabase client.");
    return '';
  }

  try {
    // Generate a unique filename to prevent collisions and RLS conflicts on existing objects
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Path: userId/propertyId/filename
    const filePath = `${userId}/${propertyId}/${fileName}`;

    console.log(`Initiating Supabase upload: ${filePath} (${file.type}, ${file.size} bytes)`);

    // Perform the upload to the case-sensitive 'Images' bucket
    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (error) {
      console.error('Supabase storage error details:', error);
      // provide a helpful hint for the RLS policy issue which is the most common cause of 403 errors
      throw new Error(`${error.message} (Hint: Ensure your 'Images' bucket RLS policy for INSERT uses CHECK (bucket_id = 'Images') for the 'anon' role)`);
    }

    // Retrieve the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);

    console.log(`Supabase upload successful. Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('Upload pipeline critical failure:', err.message);
    throw err;
  }
};
