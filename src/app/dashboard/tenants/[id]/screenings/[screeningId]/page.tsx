'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, User, Download, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend the autoTable interface in jsPDF
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

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
const NotesDisplay = ({ notes, title = "Notes" }: { notes: string | undefined, title?: string }) => {
  if (!notes) return null;
  return (
    <div className="mt-4 rounded-md border border-dashed bg-muted/50 p-4">
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
    </div>
  );
};

const LandlordContactInfo = ({ data }: { data: any }) => {
  if (!data || (!data.name && !data.email && !data.phone)) {
    return null;
  }
  return (
    <div className="mb-4 grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border p-4 sm:grid-cols-2">
      <h4 className="sm:col-span-2 text-base font-semibold mb-2">Landlord Contact Details</h4>
      {data.name && <div className="text-sm sm:col-span-2"><p className="font-medium">Name</p><p className="text-muted-foreground">{data.name}</p></div>}
      {data.email && <div className="text-sm"><p className="font-medium">Email</p><p className="text-muted-foreground">{data.email}</p></div>}
      {data.phone && <div className="text-sm"><p className="font-medium">Phone</p><p className="text-muted-foreground">{data.phone}</p></div>}
    </div>
  );
};


// Component to display a whole section of the screening
const ScreeningSection = ({ title, data, fields, notesKey = 'notes' }: { title: string, data: any, fields: {key: string, label: string}[], notesKey?: string }) => {
    if (!data) return null;
    // Check if any field in this section has a value
    const hasData = fields.some(field => data[field.key] !== undefined && data[field.key] !== false && data[field.key] !== '') || data[notesKey];
    if (!hasData) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                 {title === 'Previous Landlord Reference' && <LandlordContactInfo data={data} />}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fields.map(field => (data[field.key] !== undefined && data[field.key] !== false) &&
                      <ChecklistItemDisplay key={field.key} label={field.label} checked={data[field.key]} />
                    )}
                </div>
                <NotesDisplay notes={data[notesKey]} />
            </CardContent>
        </Card>
    );
};

const screeningSections = {
  rightToRent: { title: 'Right to Rent Check', fields: [{ key: 'ukPassport', label: 'Checked valid UK Passport' }, { key: 'shareCode', label: 'Used Home Office online check' }, { key: 'visaPermit', label: 'Checked valid Visa / Residence Permit' }] },
  idVerification: { title: 'ID Verification', fields: [{ key: 'photoMatch', label: 'Photo on ID matches applicant' }, { key: 'nameMatch', label: 'Name matches on all documents' }, { key: 'dobConsistent', label: 'Date of Birth is consistent' }] },
  creditCheck: { title: 'Credit Check', fields: [{ key: 'reportReceived', label: 'Report Received' }, { key: 'passed', label: 'Passed' }] },
  employmentIncome: { title: 'Employment & Income Check', fields: [{ key: 'bankStatements', label: "3 months' bank statements" }, { key: 'payslips', label: "3 months' payslips" }, { key: 'employmentContract', label: 'Employment contract' }, { key: 'employerReference', label: 'Employer reference' }, { key: 'sa302', label: 'SA302 / Tax returns' }, { key: 'accountantReference', label: 'Accountant reference' }] },
  landlordReference: { title: 'Previous Landlord Reference', fields: [{ key: 'rentOnTime', label: 'Paid rent on time?' }, { key: 'anyArrears', label: 'Any arrears?' }, { key: 'propertyConditionGood', label: 'Property kept in good condition?' }, { key: 'wouldRentAgain', label: 'Would they rent to them again?' }] },
  addressHistory: { title: 'Address History', fields: [{ key: 'verified', label: 'Address history verified' }] },
  affordability: { title: 'Affordability Stress Test', fields: [{ key: 'passed', label: 'Passes affordability test' }, { key: 'guarantorConsidered', label: 'Guarantor considered/required' }] },
  guarantor: { title: 'Guarantor Checks', fields: [{ key: 'required', label: 'Guarantor was required' }, { key: 'idCheck', label: 'Guarantor ID check complete' }, { key: 'creditCheck', label: 'Guarantor credit check complete' }, { key: 'incomeVerified', label: 'Guarantor income verified' }] },
};


// Main Page Component
export default function ViewScreeningPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.id as string;
  const screeningId = params.screeningId as string;
  const propertyId = searchParams.get('propertyId');
  const firestore = useFirestore();
  const { user } = useUser();

  const screeningRef = useMemoFirebase(() => {
    if (!firestore || !user || !tenantId || !screeningId || !propertyId) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId, 'screenings', screeningId);
  }, [firestore, user, tenantId, screeningId, propertyId]);
  const { data: screening, isLoading: isLoadingScreening, error: screeningError } = useDoc(screeningRef);
  
  const tenantRef = useMemoFirebase(() => {
    if(!firestore || !user || !tenantId || !propertyId) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId);
  }, [firestore, user, tenantId, propertyId]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc(tenantRef);

  const generatePDF = () => {
    if (!screening || !tenant) return;

    const doc = new jsPDF();
    const screeningDate = screening.screeningDate?.seconds ? format(new Date(screening.screeningDate.seconds * 1000), 'PPP') : 'N/A';
    let finalY = 0;

    doc.setFontSize(20);
    doc.text('Tenant Screening Report', 14, 22);
    doc.setFontSize(12);
    doc.text(`Tenant: ${tenant.name}`, 14, 30);
    doc.text(`Screening Date: ${screeningDate}`, 14, 36);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 200, 40);
    finalY = 45;

    const addSectionToPdf = (title: string, data: any, fields: {key: string, label: string}[]) => {
      if (!data) return;
      const hasData = fields.some(field => data[field.key]) || data.notes || (title === 'Previous Landlord Reference' && (data.name || data.email || data.phone));
      if (!hasData) return;

      doc.setFontSize(14);
      doc.text(title, 14, finalY);
      finalY += 7;

      if (title === 'Previous Landlord Reference' && data) {
        const details = [
            data.name && ['Name', data.name],
            data.email && ['Email', data.email],
            data.phone && ['Phone', data.phone],
        ].filter(Boolean) as string[][];

        if (details.length > 0) {
            doc.autoTable({
                startY: finalY,
                body: details,
                theme: 'plain',
                styles: { cellPadding: 1, fontSize: 10 },
                columnStyles: { 0: { fontStyle: 'bold' } },
                didDrawPage: (d) => { finalY = d.cursor.y; }
            });
            finalY = (doc as any).lastAutoTable.finalY + 2;
        }
      }

      const tableBody = fields
        .filter(field => data[field.key] !== undefined && data[field.key] !== false)
        .map(field => {
            const status = data[field.key] === true ? 'Yes' : 'No';
            return [field.label, status];
        });
      
      if (tableBody.length > 0) {
        doc.autoTable({
            startY: finalY,
            head: [['Check', 'Result']],
            body: tableBody,
            theme: 'grid'
        });
        finalY = (doc as any).lastAutoTable.finalY + 5;
      }

      if (data.notes) {
        doc.setFontSize(11);
        doc.text('Notes:', 15, finalY);
        finalY += 6;
        const splitNotes = doc.splitTextToSize(data.notes, 170);
        doc.text(splitNotes, 15, finalY);
        finalY += (splitNotes.length * 4) + 5;
      }
    };

    Object.entries(screeningSections).forEach(([key, { title, fields }]) => {
        addSectionToPdf(title, screening[key], fields);
    });

    if(screening.overallNotes) {
        doc.setFontSize(14);
        doc.text('Overall Summary & Decision', 14, finalY);
        finalY += 7;
        const splitNotes = doc.splitTextToSize(screening.overallNotes, 180);
        doc.text(splitNotes, 14, finalY);
    }
    
    doc.save(`Screening-Report-${tenant.name}.pdf`);
  };

  const isLoading = isLoadingScreening || isLoadingTenant;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (screeningError || !propertyId) {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
            <h2 className="text-lg font-bold">Failed to Load Report</h2>
            <p className="text-sm text-muted-foreground max-w-xs">There was an error loading the record details. Ensure the URL is correct and you have permission.</p>
            <Button asChild variant="outline"><Link href="/dashboard/tenants">Return to Tenants</Link></Button>
        </div>
    );
  }

  if (!screening) {
    return (
        <div className="flex flex-col items-center justify-center h-96 gap-6 p-6 text-center">
            <div className="bg-muted p-6 rounded-full">
                <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Screening Record Not Found</h2>
                <p className="text-muted-foreground max-w-xs mx-auto">This screening report may have been deleted, or you might be accessing a link without the required property context.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/dashboard/tenants">Return to Tenants List</Link>
            </Button>
        </div>
    );
  }
  
  const screeningDate = screening.screeningDate?.seconds ? format(new Date(screening.screeningDate.seconds * 1000), 'PPP') : 'N/A';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href={`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold">Screening Report</h1>
                <p className="text-muted-foreground">{tenant?.name || 'Loading tenant...'}</p>
            </div>
        </div>
         <Button onClick={generatePDF} disabled={!screening || !tenant}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Screening Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
                <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">Screening Date</p>
                    <p>{screeningDate}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <User className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">Tenant</p>
                    <p>{tenant?.name || 'N/A'}</p>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <div className="space-y-6">
        {Object.entries(screeningSections).map(([key, { title, fields }]) => (
            <ScreeningSection key={key} title={title} data={screening[key]} fields={fields} />
        ))}
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Overall Summary & Decision</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{screening.overallNotes || 'No overall summary provided.'}</p>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
