'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage.
 * Targets the case-sensitive bucket 'Images'.
 * Returns the public URL of the uploaded image.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';
  
  console.log(`Initiating Supabase media synchronization for property ${propertyId}...`);
  
  try {
    // Generate a unique, structured file name
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    // Path: userId/propertyId/filename
    const filePath = `${userId}/${propertyId}/${fileName}`;
    
    // Perform upload to Supabase 'Images' bucket
    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg'
      });

    if (error) {
      // Diagnostic check for RLS policy failure
      if (error.message.includes('new row violates row-level security policy')) {
        console.error('Supabase RLS Error: The "Images" bucket requires an INSERT policy for the "anon" role.');
        throw new Error("Supabase RLS Restriction: Please ensure your 'Images' bucket allows public uploads or has appropriate RLS policies.");
      }
      throw error;
    }

    // Retrieve the absolute public URL
    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);
    
    console.log(`Media synchronized successfully via Supabase. URL: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('Supabase upload pipeline failure:', err.message);
    throw err;
  }
};
