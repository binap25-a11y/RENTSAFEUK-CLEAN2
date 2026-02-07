'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStorage, firebaseConfig } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Link as LinkIcon, AlertTriangle, ExternalLink } from 'lucide-react';
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
          detailedMessage = `The request timed out. This is a network issue, often caused by incorrect CORS (Cross-Origin Resource Sharing) settings on your Google Cloud Storage bucket. Please follow the instructions to apply the CORS fix.`;
      } else if (error.code === 'storage/unauthorized') {
          detailedMessage = `Your security rules are denying access. This test should bypass rules, but please double-check your storage.rules file if this error persists.`;
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
  
  const gcp_bucket_url = `https://console.cloud.google.com/storage/browser/${firebaseConfig.storageBucket}`;
  const cors_command = `gcloud storage buckets update gs://${firebaseConfig.storageBucket} --cors-file=cors.json`;

  return (
    <div className="space-y-6">
      <Card className="max-w-4xl mx-auto">
          <CardHeader>
              <CardTitle>Storage Connection Test</CardTitle>
              <CardDescription>This page provides a direct test of the connection to your Firebase Storage bucket to diagnose upload issues.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Action Required: Apply CORS Fix</AlertTitle>
                  <AlertDescription>
                      The "retry-limit-exceeded" error indicates a network timeout, which is almost always caused by a missing CORS configuration on your Google Cloud Storage bucket.
                      <ol className="list-decimal list-inside space-y-2 mt-2">
                          <li>Open a new terminal in your development environment.</li>
                          <li>Ensure you are authenticated with the correct Google Cloud account.</li>
                          <li>Copy and run the following command exactly as it appears:</li>
                      </ol>
                      <pre className="mt-2 p-2 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                          <code>{cors_command}</code>
                      </pre>
                  </AlertDescription>
              </Alert>

              <div className="space-y-2">
                  <label htmlFor="file-upload" className="font-medium">2. Select a test file</label>
                  <Input id="file-upload" type="file" onChange={handleFileChange} />
              </div>

              <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
              {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                  <Upload className="mr-2 h-4 w-4" />
              )}
              3. Run Upload Test
              </Button>
          </CardContent>
          {feedback && (
              <CardFooter>
                  <Alert variant={feedback.type === 'success' ? 'default' : 'destructive'} className="w-full">
                      <AlertTitle className="font-bold flex items-center gap-2">
                          {feedback.type === 'success' ? 'Test Successful' : 'Test Failed'}
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
                          {feedback.type === 'error' && (
                              <div className="pt-2">
                                <Button size="sm" variant="secondary" asChild>
                                  <a href={gcp_bucket_url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-2 h-4 w-4"/>
                                      Check Bucket CORS Settings
                                  </a>
                                </Button>
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
