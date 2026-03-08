import { supabase } from './supabase'

export const getSignedImageUrl = async (filePath: string) => {
<<<<<<< HEAD
  if (!supabase) throw new Error('Supabase client not initialized');
  
  const { data, error } = await supabase.storage
    .from('Images')
=======
  const { data, error } = await supabase.storage
    .from('images')
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
    .createSignedUrl(filePath, 60 * 5) // 5 minutes

  if (error) throw error

  return data.signedUrl
<<<<<<< HEAD
}
=======
}
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
