'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, User, Home, Edit, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';

const sections = {
    beforeTenancy: { title: 'Before Tenancy Starts (Legal)', fields: [ { key: 'howToRentGuide', label: 'How to Rent Guide' }, { key: 'epc', label: 'Energy Performance Certificate' }, { key: 'gasSafety', label: 'Gas Safety Certificate' }, { key: 'eicr', label: 'Electrical Safety Report' }, { key: 'tenancyAgreement', label: 'Signed Tenancy Agreement' }, { key: 'rightToRent', label: 'Right to Rent check' } ]},
    deposit: { title: 'If Taking a Deposit', fields: [ { key: 'prescribedInfo', label: 'Deposit Prescribed Information' }, { key: 'schemeLeaflet', label: 'Deposit Scheme Leaflet' }, { key: 'protectionCertificate', label: 'Deposit protection certificate' } ]},
    atMoveIn: { title: 'At / Just After Move-In', fields: [ { key: 'inventory', label: 'Inventory & Schedule of Condition' }, { key: 'keysRecord', label: 'Keys issued record' }, { key: 'emergencyContacts', label: 'Emergency & repairs contact details' }, { key: 'privacyNotice', label: 'Privacy Notice (GDPR)' } ]},
    optional: { title: 'Optional but Smart', fields: [ { key: 'welcomeLetter', label: 'Welcome letter' }, { key: 'applianceManuals', label: 'Appliance manuals' }, { key: 'binInfo', label: 'Bin & recycling info' }, { key: 'parkingInfo', label: 'Parking / permit info' } ]},
}

// A robust function to handle various date formats
function safeCreateDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    // If it's already a Date object, return it
    if (dateValue instanceof Date) return dateValue;
    // Handle Firestore Timestamp object
    if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
        return new Date(dateValue.seconds * 1000);
    }
    // Handle ISO string or other date-parsable strings/numbers
    const d = new Date(dateValue);
    // Check if the parsed date is valid
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
}

// Main Page Component
export default function ViewChecklistPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  const tenantId = searchParams.get('tenantId');
  const firestore = useFirestore();
  const { user } = useUser();

  const checklistRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !id || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'checklists', id);
  }, [firestore, propertyId, id, user]);
  const { data: checklist, isLoading: isLoadingChecklist, error: checklistError } = useDoc(checklistRef);
  
  const propertyRef = useMemoFirebase(() => {
    if(!firestore || !propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  const { data: property, isLoading: isLoadingProperty } = useDoc(propertyRef);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId || !propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId);
  }, [firestore, tenantId, propertyId, user]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc(tenantRef);


  const isLoading = isLoadingChecklist || isLoadingProperty || isLoadingTenant;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (checklistError || !propertyId) {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
            <h2 className="text-lg font-bold">Access Error</h2>
            <p className="text-sm text-muted-foreground max-w-xs">There was an error accessing the checklist. Ensure the URL is correct and you have permission.</p>
            <Button asChild variant="outline"><Link href="/dashboard">Return to Dashboard</Link></Button>
        </div>
    );
  }

  if (!checklist) {
    return (
        <div className="flex flex-col items-center justify-center h-96 gap-6 p-6 text-center">
            <div className="bg-muted p-6 rounded-full">
                <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Checklist Not Found</h2>
                <p className="text-muted-foreground max-w-xs mx-auto">This checklist may have been deleted or is inaccessible.</p>
            </div>
            <Button asChild variant="outline">
                <Link href={`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`}>Return to Tenant</Link>
            </Button>
        </div>
    );
  }
  
  // Safe data access
  const completedDate = safeCreateDate(checklist.completedDate);
  const tenantName = tenant?.name || 'N/A';
  const propertyAddress = property?.address ? [property.address.street, property.address.city].filter(Boolean).join(', ') : 'N/A';


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href={`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold">Pre-Tenancy Checklist</h1>
                <p className="text-muted-foreground">{propertyAddress}</p>
            </div>
        </div>
        <Button asChild>
          <Link href={`/dashboard/checklists/${id}/edit?propertyId=${propertyId}&tenantId=${tenantId}`}>
            <Edit className="mr-2 h-4 w-4" /> Edit
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Checklist Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
                <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">Completed Date</p>
                    <p>{completedDate ? format(completedDate, 'PPP') : 'N/A'}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <User className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">For Tenant</p>
                    <p>{tenantName}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <Home className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">For Property</p>
                    <p>{propertyAddress}</p>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div className="space-y-6">
        {Object.entries(sections).map(([key, { title, fields }]) => {
          const sectionData = checklist?.[key as keyof typeof checklist];

          // Defensively check if the section data is a valid object with content.
          if (typeof sectionData !== 'object' || sectionData === null) {
            return null;
          }
          const hasContent = fields.some(field => typeof sectionData[field.key] === 'boolean') || (sectionData.notes && String(sectionData.notes).trim().length > 0);
          if (!hasContent) {
            return null;
          }

          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fields.map(field => {
                    const checked = sectionData[field.key];
                    if (typeof checked === 'boolean') {
                      return (
                         <div key={field.key} className="flex items-center justify-between rounded-md border p-3 bg-background">
                            <p className="text-sm font-medium">{field.label}</p>
                            {checked === true ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Pass</Badge>
                            ) : (
                            <Badge variant="destructive">Fail</Badge>
                            )}
                        </div>
                      )
                    }
                    return null;
                  })}
                </div>
                
                {sectionData.notes && String(sectionData.notes).trim().length > 0 && (
                   <div className="mt-4 rounded-md border border-dashed bg-muted/50 p-4">
                        <h4 className="font-semibold text-sm mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sectionData.notes}</p>
                    </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
