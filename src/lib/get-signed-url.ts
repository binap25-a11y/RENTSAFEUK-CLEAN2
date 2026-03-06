import { supabase } from './supabase'

export const getSignedImageUrl = async (filePath: string) => {
  if (!supabase) throw new Error('Supabase client not initialized');
  
  const { data, error } = await supabase.storage
    .from('Images')
    .createSignedUrl(filePath, 60 * 5) // 5 minutes

  if (error) throw error

  return data.signedUrl
}
