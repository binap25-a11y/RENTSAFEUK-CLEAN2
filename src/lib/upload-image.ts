'use client';

/**
 * Uploads a property image via the internal API route to handle Supabase storage.
 * This approach avoids exposing keys on the client and is more robust against config issues.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  try {
    if (!file) return '';
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('propertyId', propertyId);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Upload failed:', errorData.error);
      return '';
    }

    const data = await response.json();
    return data.url || '';
  } catch (err) {
    console.error('Unexpected upload error:', err);
    return '';
  }
};
