'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage, useUser } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload } from 'lucide-react';
import Link from 'next/link';

export default function UploadTestPage() {
  const { user } = useUser();
  const storage = useStorage();
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadedUrls([]);
    setFilesToUpload(e.target.files);
  };

  const handleUpload = async () => {
    if (!storage) {
      toast({ variant: 'destructive', title: 'Storage service not available.' });
      console.error('Firebase Storage instance is not available.');
      return;
    }
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to upload.' });
       console.error('User is not authenticated.');
      return;
    }
    if (!filesToUpload || filesToUpload.length === 0) {
      toast({ variant: 'destructive', title: 'No files selected.' });
      return;
    }

    setIsUploading(true);
    setUploadedUrls([]);
    const urls: string[] = [];

    // Use a sequential loop for maximum reliability
    for (const file of Array.from(filesToUpload)) {
      // Using a test directory with permissive rules for diagnostics
      const uniqueFileName = `test-uploads/${user.uid}/${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, uniqueFileName);

      try {
        toast({ title: 'Uploading...', description: `Starting upload for ${file.name}` });
        const snapshot = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snapshot.ref);
        urls.push(url);
        console.log('File available at', url);
        toast({ title: 'Success!', description: `${file.name} uploaded.` });
      } catch (error: any) {
        console.error(`Failed to upload ${file.name}:`, error);
        toast({
          variant: 'destructive',
          title: `Upload Failed for ${file.name}`,
          description: `Error: ${error.code} - ${error.message}`,
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
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Test Page</CardTitle>
        <CardDescription>
          This is a simplified page to test file uploads to Firebase Storage directly. It bypasses all complex form logic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="file-upload" className="font-medium">1. Select Files</label>
          {/* Using a standard input to avoid component conflicts */}
          <input
            id="file-upload"
            type="file"
            multiple
            onChange={handleFileChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <Button onClick={handleUpload} disabled={isUploading} className="w-full">
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
             <>
              <Upload className="mr-2 h-4 w-4" />
              2. Upload Photos to Test Directory
             </>
          )}
        </Button>

        {uploadedUrls.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Successfully Uploaded Files:</h3>
              <ul className="space-y-2 list-disc list-inside">
                {uploadedUrls.map((url, index) => (
                  <li key={index}>
                    <Link href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                      {`File ${index + 1}: View Uploaded Image`}
                    </Link>
                  </li>
                ))}
              </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
