'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUser, useStorage } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import Link from 'next/link';

export default function Maintenance2Page() {
  const { user } = useUser();
  const storage = useStorage();
  const [isUploading, setIsUploading] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setUploadedUrls([]); // Reset previous uploads
    setFilesToUpload(files);
    if (files) {
      setPhotoPreviews(Array.from(files).map(file => URL.createObjectURL(file)));
    } else {
      setPhotoPreviews([]);
    }
  };

  const handleUpload = async () => {
    if (!filesToUpload || filesToUpload.length === 0) {
      toast({ variant: 'destructive', title: 'No files selected.' });
      return;
    }
    if (!user || !storage) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please sign in again to upload files.' });
      return;
    }

    setIsUploading(true);
    toast({ title: 'Uploading photos...', description: `Uploading ${filesToUpload.length} image(s).` });

    const uploadPromises = Array.from(filesToUpload).map(file => {
      const uniqueFileName = `${Date.now()}-${file.name}`;
      const fileRef = storageRef(storage, `maintenance/${user.uid}/${uniqueFileName}`);
      return uploadBytes(fileRef, file).then(snapshot => getDownloadURL(snapshot.ref));
    });

    try {
      const finalUploadedUrls = await Promise.all(uploadPromises);
      setUploadedUrls(finalUploadedUrls);
      toast({ title: 'Upload Complete!', description: `${finalUploadedUrls.length} image(s) uploaded successfully.` });
    } catch (error) {
      console.error('Photo upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'An error occurred. Please check the console for details and try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Upload Test</CardTitle>
          <CardDescription>This is a simplified page to test file uploads directly to Firebase Storage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">1. Select Photos</Label>
            <Input
              id="file-upload"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {photoPreviews.length > 0 && (
            <div>
              <Label>Previews</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t mt-2">
                {photoPreviews.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    <Image src={url} alt={`Preview ${index + 1}`} fill className="rounded-md object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <Button onClick={handleUpload} disabled={isUploading || !filesToUpload || filesToUpload.length === 0}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            2. Upload Photos
          </Button>

          {uploadedUrls.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle className="h-5 w-5" />
                <p>Upload successful!</p>
              </div>
              <Label>Uploaded Images</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {uploadedUrls.map((url, index) => (
                    <div key={index} className="space-y-2">
                        <div className="relative aspect-square">
                            <Image src={url} alt={`Uploaded photo ${index + 1}`} fill className="rounded-md object-cover" />
                        </div>
                        <Button asChild variant="outline" size="sm" className="w-full">
                            <Link href={url} target="_blank" rel="noopener noreferrer">Preview Image</Link>
                        </Button>
                    </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
