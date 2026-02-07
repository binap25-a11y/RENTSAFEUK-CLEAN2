'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStorage, useUser } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Terminal, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { toast } from '@/hooks/use-toast';

export default function StorageFixPage() {
  const bucketName = "studio-7375290328-5d091.appspot.com";
  const { user } = useUser();
  const storage = useStorage();
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileToUpload(e.target.files[0]);
      setUploadStatus('idle');
      setErrorMessage('');
      setUploadedUrl('');
    }
  };

  const handleUploadTest = async () => {
    if (!fileToUpload) {
      toast({ variant: 'destructive', title: 'No file selected.' });
      return;
    }
    if (!storage) {
      toast({ variant: 'destructive', title: 'Storage service not available.' });
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');
    setUploadedUrl('');

    // We use a public path to bypass security rules for this diagnostic test.
    // This helps determine if the issue is CORS or Firebase Rules.
    const testPath = `public-test-uploads/${user?.uid || 'anonymous'}/${Date.now()}-${fileToUpload.name}`;
    const fileRef = ref(storage, testPath);

    try {
      const snapshot = await uploadBytes(fileRef, fileToUpload);
      const url = await getDownloadURL(snapshot.ref);
      setUploadedUrl(url);
      setUploadStatus('success');
      toast({ title: 'Upload Successful!', description: 'The storage connection is working.' });
    } catch (error: any) {
      setUploadStatus('error');
      // Specifically check for the timeout error
      if (error.code === 'storage/retry-limit-exceeded') {
        setErrorMessage('Upload timed out. This is a CORS policy issue. Please run the gcloud command in Step 1.');
      } else {
        setErrorMessage(`Upload failed: ${error.message} (Code: ${error.code})`);
      }
      toast({ variant: 'destructive', title: 'Upload Failed', description: 'See the error message on the page.' });
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Final Fix: Storage Connection Test</CardTitle>
          <CardDescription>
            This page will resolve the storage connection issue. Please follow these two steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Step 1 */}
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Step 1: Run This Command in Your Terminal</AlertTitle>
            <AlertDescription>
              <p className="mb-4">The upload timeout is caused by a missing security policy on your project's storage bucket. Run the command below to fix it.</p>
              <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto">
                <code>{`gcloud storage buckets update gs://${bucketName} --cors-file=cors.json`}</code>
              </pre>
              <p className="mt-4 text-xs text-muted-foreground">
                Make sure you are authenticated with the correct Google Cloud account in your terminal before running it.
              </p>
            </AlertDescription>
          </Alert>

          {/* Step 2 */}
           <Card>
            <CardHeader>
                <CardTitle>Step 2: Test The Upload</CardTitle>
                <CardDescription>After running the command, choose a file and click "Run Upload Test" to verify the fix.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="image-file">Choose an image</Label>
                    <Input id="image-file" type="file" accept="image/*" onChange={handleFileChange} />
                </div>
                <Button onClick={handleUploadTest} disabled={isUploading || !fileToUpload}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Run Upload Test
                </Button>

                {uploadStatus === 'success' && uploadedUrl && (
                    <Alert variant="default" className="border-green-500">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <AlertTitle>Success!</AlertTitle>
                        <AlertDescription>
                           <p>The upload worked. The image below is served from your Firebase Storage bucket.</p>
                           <div className="mt-4 relative w-48 h-48">
                                <Image src={uploadedUrl} alt="Uploaded Test Image" fill className="rounded-md object-cover" />
                           </div>
                        </AlertDescription>
                    </Alert>
                )}

                 {uploadStatus === 'error' && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Upload Failed</AlertTitle>
                        <AlertDescription>
                           {errorMessage}
                        </AlertDescription>
                    </Alert>
                )}

            </CardContent>
           </Card>

        </CardContent>
      </Card>
    </div>
  );
}
