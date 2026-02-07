'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Link as LinkIcon, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { firebaseConfig } from '@/firebase/config';

export default function EnhancedUploadTestPage() {
  const storage = useStorage();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string, url?: string, isCorsError?: boolean} | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setFeedback(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !storage) {
      setFeedback({ type: 'error', message: 'Please select a file and ensure you are logged in.' });
      return;
    }

    setIsUploading(true);
    setFeedback(null);

    const filePath = `public-test-uploads/${Date.now()}-${file.name}`;
    const fileRef = storageRef(storage, filePath);

    try {
      console.log(`[DIAGNOSTIC] Attempting to upload to: ${filePath}`);
      const snapshot = await uploadBytes(fileRef, file);
      console.log('[DIAGNOSTIC] uploadBytes successful:', snapshot);
      
      const url = await getDownloadURL(snapshot.ref);
      console.log('[DIAGNOSTIC] getDownloadURL successful:', url);

      setFeedback({
        type: 'success',
        message: 'Upload successful! This confirms the connection to Firebase Storage is working.',
        url: url,
      });

    } catch (error: any) {
      console.error('[DIAGNOSTIC] Upload Error:', error);
      const isCorsError = error.code === 'storage/unauthorized';
      let detailedMessage = `Upload Failed. Code: ${error.code}. Message: ${error.message}.`;
       if (isCorsError) {
          detailedMessage += " This strongly suggests a CORS configuration issue on your Firebase project.";
       }

      setFeedback({
        type: 'error',
        message: detailedMessage,
        isCorsError: isCorsError,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Enhanced Storage Connection Test</CardTitle>
        <CardDescription>
          This is a definitive test to verify the connection to Firebase Storage. If this fails with a permission error, it confirms a project-level CORS configuration issue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="file-upload" className="font-medium">1. Select an image file</label>
          <Input id="file-upload" type="file" onChange={handleFileChange} accept="image/*" />
        </div>

        <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
          {isUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          2. Run Upload Test
        </Button>

        {feedback && !feedback.isCorsError && (
          <div className={`p-4 border rounded-lg ${feedback.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
             <h3 className={`font-semibold ${feedback.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {feedback.type === 'success' ? 'Test Successful' : 'Test Failed'}
             </h3>
             <p className={`text-sm mt-2 ${feedback.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {feedback.message}
             </p>
            {feedback.url && (
                <div className="flex items-center gap-2 mt-3">
                    <LinkIcon className="h-4 w-4 text-muted-foreground" />
                    <Link href={feedback.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline break-all">
                        View Uploaded File
                    </Link>
                </div>
            )}
          </div>
        )}

        {feedback?.isCorsError && (
          <Alert variant="destructive" className="mt-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action Required: Fix CORS Configuration</AlertTitle>
              <AlertDescription className="space-y-2 mt-2">
                  <p>This test has confirmed the root cause: your Firebase project is blocking uploads from this web application due to its **CORS (Cross-Origin Resource Sharing)** policy.</p>
                  <p>To fix this, you need to apply a configuration file to your project's storage bucket. I have created this file for you.</p>
                  <div className="space-y-2 pt-2">
                      <p className="font-semibold">Follow these steps in your terminal:</p>
                      <ol className="list-decimal list-inside space-y-3 text-xs pl-2">
                          <li>
                              <strong>Install the Google Cloud CLI</strong> if you haven't already. You can find instructions 
                              <a href="https://cloud.google.com/storage/docs/gsutil_install" target="_blank" rel="noopener noreferrer" className="underline"> here</a>.
                          </li>
                          <li>
                              <strong>Login to your Google Cloud account</strong> by running:
                              <code className="block w-full bg-muted p-2 rounded mt-1 text-black">gcloud auth login</code>
                          </li>
                          <li>
                              I have created a file named <code className="font-semibold text-black">cors.json</code> in your project's root directory.
                          </li>
                          <li>
                              <strong>Run the command below</strong> to apply this configuration to your storage bucket:
                              <code className="block w-full bg-muted p-2 rounded mt-1 text-black overflow-x-auto">
                                  gsutil cors set cors.json gs://{firebaseConfig.storageBucket}
                              </code>
                          </li>
                      </ol>
                  </div>
                  <p className="pt-2">After the command completes successfully, please **refresh this page** and try the upload again. It should now succeed.</p>
              </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
