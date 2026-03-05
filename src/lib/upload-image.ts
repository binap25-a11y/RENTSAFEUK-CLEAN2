'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage and returns the public URL.
 * Images are organized by userId and propertyId for security and order.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  try {
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
    const filePath = `${userId}/${propertyId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('images') 
      .upload(filePath, file);

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (err) {
    console.error('Supabase upload error:', err);
    return '';
  }
};
