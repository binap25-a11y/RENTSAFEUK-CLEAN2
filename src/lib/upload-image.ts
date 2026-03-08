'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage.
 * Uses the 'Images' bucket as requested.
 * Ensure your Supabase 'Images' bucket is PUBLIC or has RLS policies for authenticated uploads.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    // Generate a unique path: {userId}/{propertyId}/{filename}
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${propertyId}/${fileName}`;

    console.log(`Initiating media sync to Supabase: ${filePath}`);

    const { data, error } = await supabase.storage
      .from('Images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase storage error:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('Images')
      .getPublicUrl(filePath);

    console.log(`Media synchronized successfully. URL: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('Supabase synchronization failed:', err.message);
    throw new Error(`Upload failed: ${err.message}`);
  }
};