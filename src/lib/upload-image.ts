'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage.
 * Uses the Supabase Client SDK for direct binary uploads to the 'Images' bucket.
 * 
 * IMPORTANT: To prevent "new row violates row-level security policy" errors,
 * ensure your 'Images' bucket has an INSERT policy for the 'anon' role
 * with the CHECK expression: (bucket_id = 'Images')
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file || !supabase) {
    console.warn("Upload execution skipped: Missing file or Supabase client.");
    return '';
  }

  try {
    // Generate a unique, collision-resistant filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Path structure: userId/propertyId/filename
    const filePath = `${userId}/${propertyId}/${fileName}`;

    console.log(`Initiating Supabase sync: ${filePath} (${file.type}, ${file.size} bytes)`);

    // Perform the binary upload to the 'Images' bucket
    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (error) {
      console.error('Supabase storage layer error:', error.message);
      // Re-throw with specific guidance for the RLS "new row" violation
      throw new Error(`${error.message} (Hint: Ensure your 'Images' bucket RLS policy for INSERT uses CHECK (bucket_id = 'Images') for the 'anon' role)`);
    }

    // Retrieve the public URL for the newly synchronized asset
    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);

    console.log(`Supabase sync successful. Resource URL: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('Upload pipeline critical failure:', err.message);
    throw err;
  }
};
