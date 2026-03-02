import { supabase } from './supabase'

export const getSignedImageUrl = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from('images')
    .createSignedUrl(filePath, 60 * 5) // 5 minutes

  if (error) throw error

  return data.signedUrl
}