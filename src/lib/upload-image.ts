import { supabase } from './supabase'

export const uploadPropertyImage = async (file: File) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random()}.${fileExt}`

  const { error } = await supabase.storage
    .from('images')
    .upload(fileName, file)

  if (error) throw error

  // IMPORTANT: return ONLY the file path
  return fileName
}