'use client';

/**
 * Uploads a property image via the internal API route to handle Supabase storage.
 * This approach avoids exposing keys on the client and is more robust against config issues.
 * Throws errors so the calling component can handle UI notifications.
 */
export const uploadPropertyImage = async (file: File, userId: string, propertyId: string): Promise<string> => {
  if (!file) return '';
  
  console.log(`Initiating media synchronization for property ${propertyId}...`);
  
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
      const errorMessage = errorData.error || 'Upload failed';
      console.error('Supabase upload pipeline failure:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`Media synchronized successfully. Public URL: ${data.url}`);
    return data.url || '';
  } catch (err: any) {
    console.error('Network or pipeline error during upload:', err.message);
    throw err;
  }
};
