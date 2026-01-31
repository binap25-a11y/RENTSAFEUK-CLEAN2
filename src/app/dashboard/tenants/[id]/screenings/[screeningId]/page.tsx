'use client';

import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, User, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
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
  const tenantId = params.id as string;
  const screeningId = params.screeningId as string;
  const firestore = useFirestore();

  const screeningRef = useMemoFirebase(() => {
    if (!firestore || !tenantId || !screeningId) return null;
    return doc(firestore, 'tenants', tenantId, 'screenings', screeningId);
  }, [firestore, tenantId, screeningId]);
  const { data: screening, isLoading: isLoadingScreening, error: screeningError } = useDoc(screeningRef);
  
  const tenantRef = useMemoFirebase(() => {
    if(!firestore || !tenantId) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId]);
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
      const hasData = fields.some(field => data[field.key]) || data.notes;
      if (!data || !hasData) return;

      doc.setFontSize(14);
      doc.text(title, 14, finalY);
      finalY += 7;

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

  if (screeningError) {
    return <div className="text-center text-destructive">Error loading screening report: {screeningError.message}</div>;
  }

  if (!screening) {
    return notFound();
  }
  
  const screeningDate = screening.screeningDate?.seconds ? format(new Date(screening.screeningDate.seconds * 1000), 'PPP') : 'N/A';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href={`/dashboard/tenants/${tenantId}`}><ArrowLeft className="h-4 w-4" /></Link>
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
