'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StorageFixPage() {
  const bucketName = "studio-7375290328-5d091.appspot.com";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fixing the Storage Connection Timeout</CardTitle>
          <CardDescription>
            The "retry-limit-exceeded" error indicates a network security issue, not a problem with the app's code. It's caused by a missing CORS policy on your Google Cloud Storage bucket.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Terminal className="h-4 w-4" />
            <AlertTitle>Action Required</AlertTitle>
            <AlertDescription>
              <p className="mb-4">To fix the upload timeout, you must run the following command in your terminal. This updates your project's security policy to allow uploads from the app.</p>
              <pre className="p-4 rounded-md bg-muted text-sm overflow-x-auto">
                <code>{`gcloud storage buckets update gs://${bucketName} --cors-file=cors.json`}</code>
              </pre>
              <p className="mt-4 text-xs text-muted-foreground">
                This command uses the <code>cors.json</code> file in your project root. Ensure you are authenticated with the correct Google Cloud account in your terminal before running it. After running the command, you can use the file upload features throughout the app.
              </p>
            </AlertDescription>
          </Alert>
           <div className="text-center pt-4">
              <Button asChild>
                <Link href="/dashboard/documents/upload">Test with Document Upload</Link>
              </Button>
           </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>What is CORS?</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                Cross-Origin Resource Sharing (CORS) is a security feature that browsers use to restrict how resources on a web page can be requested from another domain. Your app runs on one domain, and Firebase Storage is on another. For your app to upload files, the storage server must explicitly tell the browser that it's allowed. The <code>gcloud</code> command applies a configuration file (<code>cors.json</code>) to your storage bucket that grants this permission.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
