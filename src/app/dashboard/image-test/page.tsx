'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage, useUser } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

export default function ImageTestPage() {
  const { user } = useUser();
  const storage = useStorage();
  const { toast } = useToast();

  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToUpload(e.target.files[0]);
      setPreviewUrl(null); // Clear previous preview
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload) {
      toast({
        variant: 'destructive',
        title: 'No File Selected',
        description: 'Please select an image file to upload.',
      });
      return;
    }
    if (!storage || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User not authenticated or storage not available.',
      });
      return;
    }

    setIsUploading(true);
    setPreviewUrl(null);

    const uniqueFileName = `${user.uid}-${Date.now()}-${fileToUpload.name}`;
    const fileRef = storageRef(storage, `images/${user.uid}/${uniqueFileName}`);

    try {
      const uploadResult = await uploadBytes(fileRef, fileToUpload);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      setPreviewUrl(downloadUrl);
      toast({
        title: 'Upload Successful',
        description: 'Image has been uploaded and is now previewed below.',
      });
    } catch (error: any) {
      console.error('Image Upload Error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold">Image Upload Test</h1>
        <p className="text-muted-foreground">
          Use this page to test uploading an image and previewing it.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Upload an Image</CardTitle>
          <CardDescription>
            Select an image file from your device and click upload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="image-upload">Picture</Label>
            <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          <Button onClick={handleUpload} disabled={isUploading || !fileToUpload}>
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Upload Image
          </Button>
        </CardContent>
      </Card>

      {previewUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-md border">
              <Image
                src={previewUrl}
                alt="Uploaded image preview"
                fill
                className="object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
