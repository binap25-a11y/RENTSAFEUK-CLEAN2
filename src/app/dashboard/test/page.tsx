'use client';

import { useState } from 'react';
import { useUser, useStorage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import Image from 'next/image';

export default function TestPage() {
  const { user } = useUser();
  const storage = useStorage();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadURL, setDownloadURL] = useState<string | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setDownloadURL(null); // Reset URL when new file is selected
      
      // Create a URL for local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewURL(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user || !storage) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Please select a file and ensure you are logged in.',
      });
      return;
    }

    setIsUploading(true);
    setDownloadURL(null);

    const uniqueFileName = `${Date.now()}-${file.name}`;
    const fileRef = ref(storage, `test-uploads/${user.uid}/${uniqueFileName}`);

    try {
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setDownloadURL(url);
      toast({
        title: 'Upload successful',
        description: 'Your image has been uploaded and is now being served from Firebase Storage.',
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Test Image Upload</CardTitle>
          <CardDescription>
            Use this page to test image uploads to Firebase Storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="file-upload" className="font-medium">Select Image</label>
            <Input id="file-upload" type="file" accept="image/*" onChange={handleFileChange} />
          </div>

          {previewURL && (
            <div className="p-4 bg-muted rounded-md space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                    {downloadURL ? 'Uploaded Image:' : 'Image Preview:'}
                </p>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                    <Image
                        src={downloadURL || previewURL}
                        alt="Image preview"
                        fill
                        className="object-contain"
                    />
                </div>
            </div>
          )}

          <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
