'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DeprecatedPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CardTitle>Page Removed</CardTitle>
                <CardDescription>This diagnostic page is no longer in use and has been replaced by the Enhanced Upload Test.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Button asChild>
                    <Link href="/dashboard/upload-test-2">
                        Go to the new Test Page
                    </Link>
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
