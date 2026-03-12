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
    if (!firestore || !id || !user) return null;
    return doc(firestore, 'checklists', id);
  }, [firestore, id, user]);
  const { data: checklist, isLoading: isLoadingChecklist, error: checklistError } = useDoc(checklistRef);
  
  const propertyRef = useMemoFirebase(() => {
    if(!firestore || !propertyId || !user) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  const { data: property, isLoading: isLoadingProperty } = useDoc(propertyRef);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId || !user) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId, user]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc(tenantRef);


  const isLoading = isLoadingChecklist || isLoadingProperty || isLoadingTenant;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (checklistError || !id) {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
            <h2 className="text-lg font-bold text-foreground">Access Error</h2>
            <p className="text-sm text-muted-foreground max-w-xs">There was an error accessing the checklist. Ensure the record exists.</p>
            <Button asChild variant="outline"><Link href="/dashboard">Return to Dashboard</Link></Button>
        </div>
    );
  }

  if (!checklist) {
    return (
        <div className="flex flex-col items-center justify-center h-96 gap-6 p-6 text-center text-left">
            <div className="bg-muted p-6 rounded-full">
                <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Checklist Not Found</h2>
                <p className="text-muted-foreground max-w-xs mx-auto">This checklist may have been deleted or is inaccessible.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/dashboard/tenants">Return to Tenants</Link>
            </Button>
        </div>
    );
  }
  
  // Safe data access
  const completedDate = safeCreateDate(checklist.completedDate);
  const tenantName = tenant?.name || 'N/A';
  const propertyAddress = property?.address ? [property.address.street, property.address.city].filter(Boolean).join(', ') : 'N/A';


  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href={`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold font-headline">Pre-Tenancy Checklist</h1>
                <p className="text-muted-foreground text-sm font-medium">{propertyAddress}</p>
            </div>
        </div>
        <Button asChild className='shadow-lg font-bold uppercase tracking-widest text-[10px] h-10 px-6'>
          <Link href={`/dashboard/checklists/${id}/edit?propertyId=${propertyId}&tenantId=${tenantId}`}>
            <Edit className="mr-2 h-3.5 w-3.5" /> Edit
          </Link>
        </Button>
      </div>
      
      <Card className='shadow-lg border-none overflow-hidden'>
        <CardHeader className='bg-primary/5 border-b'>
            <CardTitle className='text-lg font-headline'>Checklist Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-8 px-8">
            <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0"><CalendarIcon className="h-5 w-5" /></div>
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-1">Completed Date</p>
                    <p className='font-bold'>{completedDate ? format(completedDate, 'PPP') : 'N/A'}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0"><User className="h-5 w-5" /></div>
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-1">For Tenant</p>
                    <p className='font-bold'>{tenantName}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0"><Home className="h-5 w-5" /></div>
                <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-1">For Property</p>
                    <p className='font-bold line-clamp-1'>{propertyAddress}</p>
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
            <Card key={key} className='shadow-md border-none overflow-hidden'>
              <CardHeader className='bg-muted/30 border-b px-6'>
                <CardTitle className="text-lg font-headline">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6 px-6 pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fields.map(field => {
                    const checked = sectionData[field.key];
                    if (typeof checked === 'boolean') {
                      return (
                         <div key={field.key} className="flex items-center justify-between rounded-xl border-2 p-4 bg-background shadow-sm">
                            <p className="text-sm font-bold text-foreground pr-4">{field.label}</p>
                            {checked === true ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 uppercase font-bold text-[9px] px-2.5 h-6">Pass</Badge>
                            ) : (
                            <Badge variant="destructive" className='uppercase font-bold text-[9px] px-2.5 h-6'>Fail</Badge>
                            )}
                        </div>
                      )
                    }
                    return null;
                  })}
                </div>
                
                {sectionData.notes && String(sectionData.notes).trim().length > 0 && (
                   <div className="mt-4 rounded-xl border-2 border-dashed bg-muted/5 p-5">
                        <h4 className="font-bold text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Audit Notes</h4>
                        <p className="text-sm text-muted-foreground font-medium whitespace-pre-wrap leading-relaxed italic">"{sectionData.notes}"</p>
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
