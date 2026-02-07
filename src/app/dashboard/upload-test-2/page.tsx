'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useStorage, useUser } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import Link from 'next/link';

export default function UploadTest2Page() {
  const { user } = useUser();
  const storage = useStorage();
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadedUrl('');
    if (e.target.files && e.target.files.length > 0) {
        setFileToUpload(e.target.files[0]);
    } else {
        setFileToUpload(null);
    }
  };

  const handleUpload = async () => {
    if (!storage) {
      toast({ variant: 'destructive', title: 'Storage service not available.' });
      return;
    }
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to upload.' });
      return;
    }
    if (!fileToUpload) {
      toast({ variant: 'destructive', title: 'No file selected.' });
      return;
    }

    setIsUploading(true);
    setUploadedUrl('');
    
    // Using a simplified path for maximum reliability during diagnostics
    const uniqueFileName = `test-uploads/${Date.now()}-${fileToUpload.name}`;
    const fileRef = storageRef(storage, uniqueFileName);

    try {
        toast({ title: 'Uploading...', description: `Starting upload for ${fileToUpload.name}` });
        const snapshot = await uploadBytes(fileRef, fileToUpload);
        const url = await getDownloadURL(snapshot.ref);
        
        setUploadedUrl(url);
        toast({ title: 'Success!', description: `${fileToUpload.name} uploaded.` });

    } catch (error: any) {
        console.error(`Failed to upload ${fileToUpload.name}:`, error);
        toast({
            variant: 'destructive',
            title: `Upload Failed`,
            description: `Error: ${error.code} - ${error.message}`,
        });
    } finally {
        setIsUploading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Test Page 2</CardTitle>
        <CardDescription>
          A second diagnostic page to test a single file upload to Firebase Storage. This uses the most direct upload method.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="file-upload" className="font-medium">1. Select a File</label>
          <input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <Button onClick={handleUpload} disabled={isUploading || !fileToUpload} className="w-full">
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
             <>
              <Upload className="mr-2 h-4 w-4" />
              2. Upload to Test Directory
             </>
          )}
        </Button>

        {uploadedUrl && (
          <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Successfully Uploaded File:</h3>
              <div className="text-sm">
                <Link href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                  View Uploaded File
                </Link>
              </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
