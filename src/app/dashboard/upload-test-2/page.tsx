'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStorage, useUser } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from '@/hooks/use-toast';
import { Loader2, Upload, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

export default function UploadTest2Page() {
  const { user } = useUser();
  const storage = useStorage();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadURL, setDownloadURL] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setDownloadURL('');
    }
  };

  const handleUpload = async () => {
    if (!file || !storage || !user) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Please select a file and ensure you are logged in.',
      });
      return;
    }

    setIsUploading(true);
    setDownloadURL('');

    // Use a simplified path to avoid security rule conflicts with other rules.
    const filePath = `test-uploads/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, filePath);

    try {
      toast({
        title: 'Uploading...',
        description: `Your file "${file.name}" is being uploaded.`,
      });

      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);

      setDownloadURL(url);
      toast({
        title: 'Upload Successful!',
        description: 'The file has been stored in Firebase Storage.',
      });
    } catch (error: any) {
      console.error('Upload Error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: `Code: ${error.code}\nMessage: ${error.message}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Firebase Storage Connection Test</CardTitle>
        <CardDescription>
          This page provides a simple, direct way to test the file upload connection to Firebase Storage.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="file-upload" className="font-medium">1. Select a file</label>
          <Input id="file-upload" type="file" onChange={handleFileChange} />
        </div>

        <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          2. Upload to Firebase Storage
        </Button>

        {downloadURL && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
             <h3 className="font-semibold text-green-800">Success!</h3>
             <p className="text-sm text-green-700">The file was uploaded successfully. You can view it using the link below.</p>
            <div className="flex items-center gap-2">
                 <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <Link href={downloadURL} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
                    {downloadURL}
                </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
