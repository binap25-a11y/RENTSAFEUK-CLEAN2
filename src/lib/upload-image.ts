'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage and returns the public URL.
 * Images are organized by userId and propertyId for security and order.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  try {
    if (!file) return '';
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${propertyId}/${fileName}`;

    // Upload to 'images' bucket
    const { data, error } = await supabase.storage
      .from('images') 
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase storage upload error:', error.message);
      return '';
    }

    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return urlData.publicUrl || '';
  } catch (err) {
    console.error('Unexpected Supabase upload error:', err);
    return '';
  }
};
