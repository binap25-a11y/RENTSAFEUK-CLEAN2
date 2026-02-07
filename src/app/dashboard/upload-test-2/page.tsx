'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStorage, firebaseConfig } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function StorageTestPage() {
  const storage = useStorage();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string, code?: string, url?: string} | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFeedback(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !storage) {
      setFeedback({ type: 'error', message: 'Please select a file to test the upload.' });
      return;
    }

    setIsUploading(true);
    setFeedback(null);

    const filePath = `public-test-uploads/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, filePath);

    try {
      const snapshot = await uploadBytes(fileRef, file);
      const url = await getDownloadURL(snapshot.ref);
      
      setFeedback({
        type: 'success',
        message: 'Upload successful! The connection to Firebase Storage is working correctly.',
        url: url,
      });

    } catch (error: any) {
      console.error('[DIAGNOSTIC] Upload Error:', error);
      
      let detailedMessage = `An unknown error occurred. Please check the browser console for more details.`;
      if(error.code === 'storage/retry-limit-exceeded') {
          detailedMessage = `The request timed out. This may be a network issue or an incorrect CORS (Cross-Origin Resource Sharing) policy on your Google Cloud Storage bucket.`;
      } else if (error.code === 'storage/unauthorized') {
          detailedMessage = `Your security rules are denying access. This is unexpected on the test path, but indicates a problem with the storage rules.`;
      } else {
          detailedMessage = error.message;
      }

      setFeedback({
        type: 'error',
        message: detailedMessage,
        code: error.code || 'N/A',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <Card className="max-w-4xl mx-auto">
          <CardHeader>
              <CardTitle>Storage Connection Test</CardTitle>
              <CardDescription>This page helps diagnose issues with uploading files to Firebase Storage. Use the tool below to test your connection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="space-y-2 pt-4">
                  <label htmlFor="file-upload" className="font-medium">1. Select a file</label>
                  <Input id="file-upload" type="file" onChange={handleFileChange} />
              </div>

              <Button onClick={handleUpload} disabled={isUploading || !file} className="w-full">
              {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                  <Upload className="mr-2 h-4 w-4" />
              )}
              2. Run Upload Test
              </Button>
          </CardContent>
          {feedback && (
              <CardFooter>
                  <Alert variant={feedback.type === 'success' ? 'default' : 'destructive'} className="w-full">
                      <AlertTitle className="font-bold flex items-center gap-2">
                          {feedback.type === 'success' ? 'Test Successful!' : 'Test Failed'}
                      </AlertTitle>
                      <AlertDescription className="space-y-2">
                          <p>{feedback.message}</p>
                          {feedback.code && <p><strong>Error Code:</strong> {feedback.code}</p>}
                          {feedback.url && (
                              <div className="flex items-center gap-2 mt-2">
                                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                  <Link href={feedback.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
                                      View Uploaded File
                                  </Link>
                              </div>
                          )}
                      </AlertDescription>
                  </Alert>
              </CardFooter>
          )}
        </Card>
    </div>
  );
}
