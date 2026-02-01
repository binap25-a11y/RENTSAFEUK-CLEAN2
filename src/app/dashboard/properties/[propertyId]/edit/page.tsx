'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';

export default function BlankEditPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Blank Page</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This page has been intentionally left blank for testing purposes.</p>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        {propertyId && (
            <Button asChild variant="outline">
                <Link href={`/dashboard/properties/${propertyId}`}>Back to Property Details</Link>
            </Button>
        )}
        <Button asChild variant="outline">
                <Link href={`/dashboard/properties`}>Back to Properties List</Link>
        </Button>
      </div>
    </div>
  );
}
