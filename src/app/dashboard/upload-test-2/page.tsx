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
          detailedMessage = `The request timed out. This is a network issue, caused by an incorrect CORS (Cross-Origin Resource Sharing) policy on your Google Cloud Storage bucket. Please follow the instructions above to apply the fix.`;
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
  
  const cors_command = `gcloud storage buckets update gs://${firebaseConfig.storageBucket} --cors-file=cors.json`;

  return (
    <div className="space-y-6">
      <Card className="max-w-4xl mx-auto">
          <CardHeader>
              <CardTitle>Final Diagnosis: Storage Connection Test</CardTitle>
              <CardDescription>Your uploads are failing due to a network timeout. This indicates a project configuration issue (CORS). Follow these steps exactly to fix it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Action Required: Apply CORS Fix</AlertTitle>
                  <AlertDescription>
                      <p className="mb-2">To fix the upload timeout, you must run the following command in your terminal. This updates your project's security policy to allow uploads from the app.</p>
                      <pre className="mt-2 p-2 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                          <code>{cors_command}</code>
                      </pre>
                       <p className="mt-2 text-xs">This command uses the `cors.json` file in your project root. Ensure you are authenticated with the correct Google Cloud account in your terminal before running it.</p>
                  </AlertDescription>
              </Alert>

              <div className="space-y-2 pt-4">
                  <label htmlFor="file-upload" className="font-medium">After applying the fix, test here:</label>
                  <Input id="file-upload" type="file" onChange={handleFileChange} />
              </div>

              <Button onClick={handleUpload} disabled={isUploading} className="w-full">
              {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                  <Upload className="mr-2 h-4 w-4" />
              )}
              Run Upload Test
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
