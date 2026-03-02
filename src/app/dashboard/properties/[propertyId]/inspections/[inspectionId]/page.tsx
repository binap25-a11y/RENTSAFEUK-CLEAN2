'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function RedirectInspectionPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;
  const inspectionId = params.inspectionId as string;

  useEffect(() => {
    if (propertyId && inspectionId) {
      router.replace(`/dashboard/inspections/${inspectionId}?propertyId=${propertyId}`);
    } else {
      // Fallback if params are missing for any reason
      router.replace('/dashboard/inspections');
    }
  }, [router, propertyId, inspectionId]);

  // Render a loading state to avoid a flash of blank content and to inform the user
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
