'use client';

import { useParams, notFound, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, User, Home } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

// Helper component to display a checklist item
const ChecklistItemDisplay = ({ label, checked }: { label: string; checked: boolean | undefined }) => (
  <div className="flex items-center justify-between rounded-md border p-3 bg-background">
    <p className="text-sm font-medium">{label}</p>
    {checked === true ? (
      <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">Pass</Badge>
    ) : checked === false ? (
      <Badge variant="destructive">Fail</Badge>
    ) : (
      <Badge variant="outline">N/A</Badge>
    )}
  </div>
);

// Helper component to display notes for a section
const NotesDisplay = ({ notes }: { notes: string | undefined }) => {
  if (!notes) return null;
  return (
    <div className="mt-4 rounded-md border border-dashed bg-muted/50 p-4">
      <h4 className="font-semibold text-sm mb-2">Notes</h4>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
    </div>
  );
};

// Component to display a whole section of the checklist
const ChecklistSection = ({ title, data, fields }: { title: string, data: any, fields: {key: string, label: string}[] }) => {
    // If the entire data object for this section is null or undefined, don't render anything.
    if (!data) {
        return null;
    }

    // Check if there is any meaningful data to display in this section.
    // This prevents rendering an empty card if all checkboxes were left unchecked and there are no notes.
    const hasMeaningfulData = fields.some(field => typeof data[field.key] === 'boolean') || (data.notes && data.notes.trim() !== '');

    if (!hasMeaningfulData) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fields.map(field => (
                        // Explicitly check for boolean type to avoid rendering for other falsy values.
                        (typeof data[field.key] === 'boolean') &&
                        <ChecklistItemDisplay key={field.key} label={field.label} checked={data[field.key]} />
                    ))}
                </div>
                <NotesDisplay notes={data.notes} />
            </CardContent>
        </Card>
    );
};

const sections = {
    beforeTenancy: { title: 'Before Tenancy Starts (Legal)', fields: [ { key: 'howToRentGuide', label: 'How to Rent Guide' }, { key: 'epc', label: 'Energy Performance Certificate' }, { key: 'gasSafety', label: 'Gas Safety Certificate' }, { key: 'eicr', label: 'Electrical Safety Report' }, { key: 'tenancyAgreement', label: 'Signed Tenancy Agreement' }, { key: 'rightToRent', label: 'Right to Rent check' } ]},
    deposit: { title: 'If Taking a Deposit', fields: [ { key: 'prescribedInfo', label: 'Deposit Prescribed Information' }, { key: 'schemeLeaflet', label: 'Deposit Scheme Leaflet' }, { key: 'protectionCertificate', label: 'Deposit protection certificate' } ]},
    atMoveIn: { title: 'At / Just After Move-In', fields: [ { key: 'inventory', label: 'Inventory & Schedule of Condition' }, { key: 'keysRecord', label: 'Keys issued record' }, { key: 'emergencyContacts', label: 'Emergency & repairs contact details' }, { key: 'privacyNotice', label: 'Privacy Notice (GDPR)' } ]},
    optional: { title: 'Optional but Smart', fields: [ { key: 'welcomeLetter', label: 'Welcome letter' }, { key: 'applianceManuals', label: 'Appliance manuals' }, { key: 'binInfo', label: 'Bin & recycling info' }, { key: 'parkingInfo', label: 'Parking / permit info' } ]},
}


// Main Page Component
export default function ViewChecklistPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  const tenantId = searchParams.get('tenantId');
  const firestore = useFirestore();

  const checklistRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !id) return null;
    return doc(firestore, 'properties', propertyId, 'checklists', id);
  }, [firestore, propertyId, id]);
  const { data: checklist, isLoading: isLoadingChecklist, error: checklistError } = useDoc(checklistRef);
  
  const propertyRef = useMemoFirebase(() => {
    if(!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc(propertyRef);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc(tenantRef);


  const isLoading = isLoadingChecklist || isLoadingProperty || isLoadingTenant;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (checklistError) {
    return <div className="text-center text-destructive">Error loading checklist: {checklistError.message}</div>;
  }

  if (!checklist) {
    return notFound();
  }
  
  const completedDate = checklist.completedDate?.seconds ? format(new Date(checklist.completedDate.seconds * 1000), 'PPP') : 'N/A';
  const tenantName = tenant?.name || 'Loading tenant...';
  const propertyAddress = property?.address ? [property.address.street, property.address.city].filter(Boolean).join(', ') : 'Loading property...';


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href={`/dashboard/tenants/${tenantId}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold">Pre-Tenancy Checklist</h1>
                <p className="text-muted-foreground">{propertyAddress}</p>
            </div>
        </div>
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
                    <p>{completedDate}</p>
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
        {Object.entries(sections).map(([key, { title, fields }]) => (
            <ChecklistSection key={key} title={title} data={checklist[key]} fields={fields} />
        ))}
      </div>

    </div>
  );
}
