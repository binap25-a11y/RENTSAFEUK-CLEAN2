'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Maintenance2Page() {
  const storage = useStorage();
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilesToUpload(event.target.files);
    setUploadedUrls([]); // Reset on new file selection
  };

  const handleUpload = async () => {
    // 1. Check if storage service is available
    if (!storage) {
      toast({
        variant: 'destructive',
        title: 'Error: Storage Not Ready',
        description: 'The Firebase Storage service is not available. Please try again.',
      });
      console.error('Firebase Storage instance is not available.');
      return;
    }

    // 2. Check if files are selected
    if (!filesToUpload || filesToUpload.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Files Selected',
        description: 'Please select one or more files to upload.',
      });
      return;
    }
    
    setIsUploading(true);
    setUploadedUrls([]);
    const urls: string[] = [];

    // Use a standard for-loop to upload files sequentially for maximum reliability
    for (const file of Array.from(filesToUpload)) {
      const uniqueFileName = `${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, `test-uploads/${uniqueFileName}`);
      
      console.log(`--- Starting Upload for ${file.name} ---`);
      console.log('File object:', file);
      console.log('Target Storage Path:', fileRef.fullPath);
      toast({ title: `Uploading ${file.name}...` });

      try {
        // 3. Perform the upload
        const uploadResult = await uploadBytes(fileRef, file);
        console.log(`Upload successful for ${file.name}. Result:`, uploadResult);
        
        // 4. Get the download URL
        const url = await getDownloadURL(uploadResult.ref);
        console.log(`Successfully got download URL:`, url);
        urls.push(url);

        toast({
          title: `Success: ${file.name} uploaded!`,
        });

      } catch (error: any) {
        // 5. Log EVERYTHING on error
        console.error(`--- UPLOAD FAILED for ${file.name} ---`);
        console.error('Error Code:', error.code);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Full Error Object:', error);

        toast({
          variant: 'destructive',
          title: `Upload Failed: ${file.name}`,
          description: `Error: ${error.message}. Check the console for more details.`,
          duration: 9000,
        });
        
        // Stop on first error
        setIsUploading(false);
        return;
      }
    }
    
    setUploadedUrls(urls);
    setIsUploading(false);
  };

  return (
    <div className="p-8 space-y-6 max-w-xl mx-auto border rounded-lg bg-card text-card-foreground">
      <h1 className="text-xl font-bold">File Upload Diagnostic Page</h1>
      <p className="text-sm text-muted-foreground">
        This is a simplified test environment. It uses a highly permissive security rule for the upload path `/test-uploads/` for diagnostic purposes.
      </p>
      
      <div className="space-y-2">
        <label htmlFor="file-input" className="font-medium text-sm">Step 1: Select one or more files</label>
        <input 
          id="file-input"
          type="file"
          multiple
          onChange={handleFileChange}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Button
        onClick={handleUpload}
        disabled={isUploading}
      >
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Step 2: Upload Photos
      </Button>

      {uploadedUrls.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <h2 className="font-semibold">Successfully Uploaded Files:</h2>
          <ul className="space-y-2 list-disc list-inside">
            {uploadedUrls.map((url, index) => (
              <li key={index} className="text-sm">
                <Link href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                  {url}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
