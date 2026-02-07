'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Link as LinkIcon, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  return (
    <div className="space-y-6">
      <Card className="max-w-4xl mx-auto">
          <CardHeader>
              <CardTitle>Test Storage Connection</CardTitle>
              <CardDescription>Now that the CORS fix has been applied, please select an image file and run the upload test to verify the connection.</CardDescription>
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
