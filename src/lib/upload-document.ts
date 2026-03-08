'use client';

import { supabase } from './supabase';

/**
 * Uploads a document file to Supabase Storage.
 */
export const uploadPropertyDocument = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';

  try {
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${propertyId}/documents/${fileName}`;

    console.log(`Uploading document to Supabase: ${filePath}`);

    const { data, error } = await supabase.storage
      .from('Images') // Assuming 'Images' bucket is used for all property media
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

    console.log(`Document uploaded successfully. URL: ${publicUrl}`);
    return publicUrl;
  } catch (err: any) {
    console.error('Supabase document upload failed:', err.message);
    throw new Error(`Upload failed: ${err.message}`);
  }
};
