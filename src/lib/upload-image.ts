'use client';

import { supabase } from './supabase';

/**
 * Uploads a property image to Supabase Storage and returns the public URL.
 * Images are organized by userId and propertyId for security and order.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  try {
    if (!file) return '';
    
    // Safety check for keys
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !supabase) {
        console.error('Supabase client is not initialized. Please check your keys in src/lib/supabase.ts');
        return '';
    }

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
      if (error.message.includes('Invalid Compact JWS')) {
          console.error('SUPABASE CONFIG ERROR: You are using an invalid Anon Key. This often happens if you accidentally pasted a Stripe key (sb_publishable_...) instead of a Supabase Anon Key (eyJ...). Please update your keys in the Supabase dashboard.');
      } else {
          console.error('Supabase storage upload error:', error.message);
      }
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
