
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Link as LinkIcon, AlertTriangle, Terminal } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { firebaseConfig } from '@/firebase/config';

export default function EnhancedUploadTestPage() {
  const storage = useStorage();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string, url?: string} | null>(null);

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
        message: 'Upload successful! The connection to Firebase Storage is working correctly. The CORS policy has been successfully applied.',
        url: url,
      });

    } catch (error: any) {
      console.error('[DIAGNOSTIC] Upload Error:', error);
      setFeedback({
        type: 'error',
        message: `Upload Failed after applying fix. Code: ${error.code}. Message: ${error.message}. This indicates a deeper project or network issue.`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const command = `gcloud storage buckets update gs://${firebaseConfig.storageBucket} --cors-file=cors.json`;

  return (
    <div className="space-y-6">
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive h-6 w-6" /> Final Diagnostic & Fix</CardTitle>
        <CardDescription>
          The "retry-limit-exceeded" error indicates a fundamental network issue, most likely due to your Firebase project's CORS policy blocking uploads. The steps below will fix this permanently.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
            <h3 className="font-semibold text-lg mb-2">Step 1: Apply the CORS Fix</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Open a new terminal in your development environment and run the following command. This is a one-time operation that updates your Firebase project's security settings to allow uploads from your web application.
            </p>
            <div className="bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 flex-shrink-0" />
                    <code className="break-all">{command}</code>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>

    <Card className="max-w-4xl mx-auto">
        <CardHeader>
            <h3 className="font-semibold text-lg">Step 2: Test the Connection</h3>
            <CardDescription>After successfully running the command above, select an image file and run the upload test to verify the fix.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-2">
                <label htmlFor="file-upload" className="font-medium">Select an image file</label>
                <Input id="file-upload" type="file" onChange={handleFileChange} accept="image/*" />
            </div>

            <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
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
                    <AlertTitle className="font-bold">
                        {feedback.type === 'success' ? 'Test Successful' : 'Test Failed'}
                    </AlertTitle>
                    <AlertDescription>
                        {feedback.message}
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
