'use client';

// This page has been deprecated and its functionality has been merged into
// the main /dashboard/maintenance page to provide a single, reliable experience.
// This file can be safely removed in the future.

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DeprecatedMaintenancePage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <CardTitle>Page Removed</CardTitle>
                <CardDescription>This test page has been removed. All functionality has been integrated into the main Maintenance page.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/dashboard/maintenance">
                        Go to Maintenance Page
                    </Link>
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
