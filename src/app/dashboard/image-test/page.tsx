'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/firebase'; // No need for useUser for this test
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, UploadCloud, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export default function ImageTestPage() {
  const storage = useStorage();
  const { toast } = useToast();

  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileToUpload(e.target.files[0]);
      setPreviewUrl(null); // Clear previous preview
      setError(null);
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
    if (!storage) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Storage service not available.',
      });
      return;
    }

    setIsUploading(true);
    setPreviewUrl(null);
    setError(null);

    // This path is configured in storage.rules to be publicly writable for testing.
    const testPath = `public-test-uploads/${Date.now()}-${fileToUpload.name}`;
    const fileRef = storageRef(storage, testPath);

    try {
      const uploadResult = await uploadBytes(fileRef, fileToUpload);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      setPreviewUrl(downloadUrl);
      setError(null);
      toast({
        title: 'Upload Successful',
        description: 'Image has been uploaded and is now previewed below.',
      });
    } catch (e: any) {
      console.error('Image Upload Error:', e);
      const errorMessage = e.message || 'An unknown error occurred.';
      setError(`Upload Failed. Code: ${e.code}. Message: ${errorMessage}`);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: errorMessage,
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
          This page tests the fundamental connection to Firebase Storage by uploading to a public test directory.
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
      
      {error && (
        <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Test Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {previewUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Image Preview</CardTitle>
            <CardDescription>This image was successfully uploaded to Firebase Storage and is now being served from there.</CardDescription>
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
