'use server';

import { redirect } from 'next/navigation';

// This is a server component to handle any old or stray links
// that might still point to the old nested inspection route.
// It permanently redirects them to the new, correct route.
export default function RedirectInspectionPage({ params }: { params: { propertyId: string; inspectionId: string } }) {
  const { propertyId, inspectionId } = params;
  
  if (propertyId && inspectionId) {
    redirect(`/dashboard/inspections/${inspectionId}?propertyId=${propertyId}`);
  } else {
    // If for some reason params are missing, redirect to the main inspections list
    redirect('/dashboard/inspections');
  }
}
