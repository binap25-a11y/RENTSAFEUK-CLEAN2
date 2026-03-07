'use client';

/**
 * Uploads a property image via the server-side proxy to Supabase.
 * This route bypasses client-side RLS complications by using the authorized server context.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  formData.append('propertyId', propertyId);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Media synchronization failed');
    }

    const { url } = await response.json();
    return url;
  } catch (err: any) {
    console.error('Upload pipeline failure:', err.message);
    throw err;
  }
};
