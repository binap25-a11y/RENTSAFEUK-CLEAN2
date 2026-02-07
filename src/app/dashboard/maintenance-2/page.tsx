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
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  
  return (
    <div className="p-8 space-y-6 max-w-xl mx-auto border rounded-lg bg-card text-card-foreground">
      <h1 className="text-xl font-bold">File Upload Test Page</h1>
      <p className="text-sm text-muted-foreground">
        This is a barebones page to test the Firebase Storage upload functionality.
      </p>
      
      <div className="space-y-2">
        <label htmlFor="file-input" className="font-medium text-sm">Step 1: Select files</label>
        <Input 
          id="file-input"
          type="file" 
          multiple 
          onChange={(e) => {
            setFilesToUpload(e.target.files);
            setUploadedUrls([]);
          }} 
        />
      </div>

      <Button
        onClick={async () => {
          if (!filesToUpload || filesToUpload.length === 0) {
            toast({ variant: 'destructive', title: 'No files selected' });
            return;
          }
          if (!user || !storage) {
            toast({ variant: 'destructive', title: 'Not authenticated' });
            return;
          }

          setIsUploading(true);
          setUploadedUrls([]);
          toast({ title: 'Upload started...' });

          const urls: string[] = [];
          try {
            for (let i = 0; i < filesToUpload.length; i++) {
              const file = filesToUpload[i];
              const uniqueFileName = `${Date.now()}-${file.name}`;
              const fileRef = storageRef(storage, `test-uploads/${user.uid}/${uniqueFileName}`);
              
              toast({ title: `Uploading ${i + 1}/${filesToUpload.length}`, description: file.name });

              await uploadBytes(fileRef, file);
              const url = await getDownloadURL(fileRef);
              urls.push(url);
            }

            setUploadedUrls(urls);
            toast({ title: 'Upload successful!', description: `${urls.length} file(s) uploaded.` });

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
        disabled={isUploading || !filesToUpload}
      >
        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Step 2: Upload Photos
      </Button>

      {uploadedUrls.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <h2 className="font-semibold">Successfully Uploaded Files:</h2>
          <ul className="space-y-2">
            {uploadedUrls.map((url, index) => (
              <li key={index} className="text-sm">
                <Link href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                  {`File ${index + 1}: ${url}`}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
