'use client';

import { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Self-contained Firebase initialization
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  // app already initialized
}
const storage = getStorage(app);


export default function UploadTest2Page() {
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileToUpload(file);
      setStatusMessage(`File selected: ${file.name}`);
      setError(null);
      setDownloadUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload) {
      setError('Please select a file first.');
      return;
    }

    setIsUploading(true);
    setStatusMessage('Starting upload...');
    setError(null);
    setDownloadUrl(null);

    // Use a public path for testing to bypass security rules
    const testPath = `public-test-uploads/${Date.now()}-${fileToUpload.name}`;
    const fileRef = ref(storage, testPath);

    try {
      setStatusMessage(`Uploading to: ${fileRef.fullPath}`);
      const uploadResult = await uploadBytes(fileRef, fileToUpload);
      setStatusMessage('Upload complete. Getting download URL...');
      const url = await getDownloadURL(uploadResult.ref);
      setDownloadUrl(url);
      setStatusMessage('Success! File is now hosted on Firebase Storage.');
    } catch (e: any) {
      console.error('Upload Error:', e);
      let errorMessage = `An error occurred during upload. Code: ${e.code}. Message: ${e.message}.`;
      if (e.code === 'storage/retry-limit-exceeded') {
        errorMessage += ' This is a network timeout, often caused by incorrect CORS configuration on your GCS bucket. Please ensure your cors.json is correctly applied.';
      }
      setError(errorMessage);
      setStatusMessage('Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Storage Connection Test</CardTitle>
          <CardDescription>
            This page provides a direct, isolated test of your Firebase Storage connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="image-upload">Select a file</Label>
            <Input id="image-upload" type="file" onChange={handleFileChange} />
          </div>
          <Button onClick={handleUpload} disabled={isUploading || !fileToUpload}>
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            Upload and Test Connection
          </Button>

          <div className="space-y-2 pt-4">
            {statusMessage && (
              <Alert variant={error ? "destructive" : "default"}>
                 <AlertCircle className="h-4 w-4" />
                <AlertTitle>Status</AlertTitle>
                <AlertDescription className="break-words">{statusMessage}</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription className="break-words">{error}</AlertDescription>
              </Alert>
            )}

            {downloadUrl && (
              <Alert variant="default" className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>Success! Download URL</AlertTitle>
                <AlertDescription className="break-words">
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-green-700 underline">
                    {downloadUrl}
                  </a>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
