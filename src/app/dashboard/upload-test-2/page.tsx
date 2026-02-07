'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStorage } from '@/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

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
      setFeedback({ type: 'error', message: 'Please select a file and ensure you are logged in.' });
      return;
    }

    setIsUploading(true);
    setFeedback(null);

    // Use a dead-simple, public path for this diagnostic test.
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
      setFeedback({
        type: 'error',
        message: `Upload Failed. Code: ${error.code}. Message: ${error.message}. Check browser console for details.`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Enhanced Storage Connection Test</CardTitle>
        <CardDescription>
          This is a definitive test to verify the connection to Firebase Storage, bypassing security rules. If this works, the problem is with the rules. If it fails, the issue is with the project setup or CORS configuration.
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

        {feedback && (
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
      </CardContent>
    </Card>
  );
}
