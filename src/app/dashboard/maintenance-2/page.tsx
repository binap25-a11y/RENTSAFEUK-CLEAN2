'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useStorage } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Maintenance2Page() {
  const { user } = useUser();
  const storage = useStorage();
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  
  return (
    <div className="p-8 space-y-6 max-w-xl mx-auto border rounded-lg bg-card text-card-foreground">
      <h1 className="text-xl font-bold">File Upload Test Page</h1>
      <p className="text-sm text-muted-foreground">
        This is a simplified test environment. Please select a single file to upload to diagnose the issue.
      </p>
      
      <div className="space-y-2">
        <label htmlFor="file-input" className="font-medium text-sm">Step 1: Select a single file</label>
        <Input 
          id="file-input"
          type="file" 
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
                setFileToUpload(e.target.files[0]);
                setUploadedUrl(null);
            } else {
                setFileToUpload(null);
            }
          }} 
        />
      </div>

      <Button
        onClick={async () => {
          if (!fileToUpload) {
            toast({ variant: 'destructive', title: 'No file selected' });
            return;
          }
          if (!user || !storage) {
            toast({ variant: 'destructive', title: 'Not authenticated or storage not ready.' });
            return;
          }

          setIsUploading(true);
          setUploadedUrl(null);
          toast({ title: 'Upload started...', description: `Uploading ${fileToUpload.name}` });

          try {
            const uniqueFileName = `${Date.now()}-${fileToUpload.name}`;
            const fileRef = storageRef(storage, `test-uploads/${user.uid}/${uniqueFileName}`);
            
            const uploadResult = await uploadBytes(fileRef, fileToUpload);
            const url = await getDownloadURL(uploadResult.ref);

            setUploadedUrl(url);
            toast({ title: 'Upload successful!', description: `File has been uploaded.` });

          } catch (error: any) {
            console.error('Upload failed:', error);
            toast({
              variant: 'destructive',
              title: 'Upload Failed',
              description: error.message || 'An unknown error occurred.',
            });
          } finally {
            setIsUploading(false);
          }
        }}
        disabled={isUploading || !fileToUpload}
      >
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Step 2: Upload Photo
      </Button>

      {uploadedUrl && (
        <div className="space-y-4 pt-4 border-t">
          <h2 className="font-semibold">Successfully Uploaded File:</h2>
          <div className="text-sm">
            <Link href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
              {uploadedUrl}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
