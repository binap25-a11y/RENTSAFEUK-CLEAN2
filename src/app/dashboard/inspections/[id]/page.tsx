'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Calendar as CalendarIcon, User, Shield, AlertTriangle, Download, AlertCircle } from 'lucide-react';
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

interface Property {
    address: {
      nameOrNumber?: string;
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
}

const formatAddress = (address: Property['address']) => {
    if (!address) return 'Unknown Property';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
};

// A helper component to display a checklist item
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

// A helper component to display notes for a section
const NotesDisplay = ({ notes, title = "Notes" }: { notes: string | undefined, title?: string }) => {
  if (!notes) return null;
  return (
    <div className="mt-4 rounded-md border border-dashed bg-muted/50 p-4">
      <h4 className="font-semibold text-sm mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
    </div>
  );
};

// A component to display a whole section of the inspection
const InspectionSection = ({ title, data, fields, notesKey = 'notes' }: { title: string, data: any, fields: {key: string, label: string}[], notesKey?: string }) => {
    if (!data) return null;
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {fields.map(field => (
                    <ChecklistItemDisplay key={field.key} label={field.label} checked={data[field.key]} />
                    ))}
                </div>
                <NotesDisplay notes={data[notesKey]} />
            </CardContent>
        </Card>
    );
};

// Fields mapping for Single-Let inspections
const singleLetSections = {
  exterior: { title: 'Exterior', fields: [{ key: 'roofCondition', label: 'Roof condition' }, { key: 'walls', label: 'Walls, brickwork' }, { key: 'windowsAndDoors', label: 'Windows and external doors' }, { key: 'garden', label: 'Garden maintained' }, { key: 'pathways', label: 'Pathways safe and clear' }, { key: 'bins', label: 'Bins accessible' }] },
  safety: { title: 'Safety & Compliance', fields: [{ key: 'smokeAlarms', label: 'Smoke alarms tested' }, { key: 'coAlarm', label: 'CO alarm tested' }, { key: 'electricalSockets', label: 'Electrical sockets safe' }, { key: 'gasCert', label: 'Gas safety certificate valid' }, { key: 'eicr', label: 'EICR valid' }, { key: 'patCert', label: 'PAT Certificate valid' }, { key: 'noTampering', label: 'No tampering with safety equipment' }] },
  interior: { title: 'Interior General Condition', fields: [{ key: 'wallsCeilingsFloors', label: 'Walls, ceilings, floors' }, { key: 'noDamp', label: 'No signs of damp or mould' }, { key: 'windows', label: 'Windows open and close' }, { key: 'doors', label: 'Internal doors and locks' }, { key: 'ventilation', label: 'Adequate ventilation' }, { key: 'cleanliness', label: 'General cleanliness acceptable' }] },
  kitchen: { title: 'Kitchen', fields: [{ key: 'worktops', label: 'Worktops, cupboards, flooring' }, { key: 'sink', label: 'Sink and taps' }, { key: 'oven', label: 'Oven and hob' }, { key: 'fridge', label: 'Fridge freezer' }, { key: 'washingMachine', label: 'Washing machine (if supplied)' }, { key: 'ventilation', label: 'Adequate ventilation' }] },
  bathrooms: { title: 'Bathrooms', fields: [{ key: 'toilet', label: 'Toilet flushing' }, { key: 'shower', label: 'Shower/bath working' }, { key: 'noLeaks', label: 'No leaks from taps/pipes' }, { key: 'extractor', label: 'Extractor fan working' }, { key: 'sealant', label: 'Sealant and grout intact' }, { key: 'noMould', label: 'No mould or damp' }] },
  heating: { title: 'Heating', fields: [{ key: 'boiler', label: 'Boiler functioning' }, { key: 'radiators', label: 'Radiators heating' }, { key: 'thermostat', label: 'Thermostat working' }, { key: 'hotWater', label: 'Hot water supply' }] },
  bedrooms: { title: 'Bedrooms', fields: [{ key: 'windows', label: 'Windows and locks' }, { key: 'heating', label: 'Heating operational' }, { key: 'noDamp', label: 'No damp or mould' }, { key: 'flooring', label: 'Flooring and walls' }, { key: 'furniture', label: 'Furniture condition (if provided)' }] },
};

const tenantResponsibilitiesFields = [{ key: 'clean', label: 'Property kept clean' }, { key: 'noOccupants', label: 'No unauthorised occupants' }, { key: 'noPets', label: 'No unauthorised pets' }, { key: 'noSmoking', label: 'No evidence of smoking' }, { key: 'noAlterations', label: 'No unauthorised alterations' }];
const followUpFields = [{ key: 'repairsRequired', label: 'Repairs Required' }, { key: 'urgentSafetyIssues', label: 'Urgent Safety Issues' }, { key: 'maintenanceScheduled', label: 'Maintenance Scheduled' }];


// Fields mapping for HMO inspections
const hmoSections = {
  fireSafety: { title: 'Fire Safety (HMO Specific)', fields: [ { key: 'interlinkedAlarms', label: 'Interlinked smoke alarms' }, { key: 'heatDetector', label: 'Heat detector in kitchen' }, { key: 'fireDoors', label: 'Fire doors self-closing' }, { key: 'doorSeals', label: 'Door intumescent strips intact' }, { key: 'extinguishers', label: 'Fire extinguishers serviced' }, { key: 'fireBlanket', label: 'Fire blanket in kitchen' }, { key: 'emergencyLighting', label: 'Emergency lighting operational' }, { key: 'clearRoutes', label: 'Fire escape routes clear' }, { key: 'signage', label: 'Fire safety signage displayed' }] },
  communal: { title: 'Communal Areas', fields: [{ key: 'clean', label: 'Clean and free from hazards' }, { key: 'lighting', label: 'Adequate lighting' }, { key: 'flooring', label: 'Flooring in good condition' }, { key: 'noDamp', label: 'No damp or mould' }, { key: 'windows', label: 'Windows and locks functioning' }, { key: 'wasteDisposal', label: 'Waste disposal area tidy' }] },
  bedrooms: { title: 'Bedrooms (Per Room)', fields: [{ key: 'doorLock', label: 'Door lock functioning' }, { key: 'ventilation', label: 'Adequate ventilation' }, { key: 'heating', label: 'Heating working' }, { key: 'noDamp', label: 'No signs of damp or mould' }, { key: 'furniture', label: 'Furniture in good condition' }, { key: 'sockets', label: 'Electrical sockets safe' }, { key: 'occupancy', label: 'Tenant occupancy confirmed' }] },
  kitchen: { title: 'Kitchen', fields: [{ key: 'appliances', label: 'Cooking appliances working' }, { key: 'extractor', label: 'Extractor fan operational' }, { key: 'sink', label: 'Sinks and taps leak-free' }, { key: 'cupboards', label: 'Worktops & cupboards good' }, { key: 'fridge', label: 'Fridge/freezer functional' }, { key: 'storage', label: 'Adequate food storage' }, { key: 'fireBlanket', label: 'Fire blanket present' }, { key: 'pat', label: 'PAT-tested appliances' }] },
  bathrooms: { title: 'Bathrooms', fields: [{ key: 'toilet', label: 'Toilet flushing correctly' }, { key: 'shower', label: 'Shower/bath working' }, { key: 'extractor', label: 'Extractor fan functioning' }, { key: 'noLeaks', label: 'No leaks or damp' }, { key: 'sealant', label: 'Sealant and grout intact' }, { key: 'hotWater', label: 'Adequate hot water supply' }] },
  utilities: { title: 'Utilities', fields: [{ key: 'boiler', label: 'Boiler functioning and serviced' }, { key: 'radiators', label: 'Radiators heating properly' }, { key: 'thermostats', label: 'Thermostats working' }, { key: 'consumerUnit', label: 'Consumer unit safe/labelled' }, { key: 'gasCert', label: 'Gas safety certificate up to date' }, { key: 'eicr', label: 'EICR valid' }] },
  exterior: { title: 'Exterior', fields: [{ key: 'roof', label: 'Roof and gutters good' }, { key: 'pathways', label: 'Pathways safe and clear' }, { key: 'garden', label: 'Garden/yard maintained' }, { key: 'bins', label: 'Bins accessible' }, { key: 'securityLighting', label: 'Security lighting working' }] },
};

const hmoTenantFields = [{ key: 'clean', label: 'Room kept clean' }, { key: 'noSmoking', label: 'No evidence of smoking' }, { key: 'noPets', label: 'No unauthorised pets' }, { key: 'noTampering', label: 'No tampering with fire equipment' }];
const hmoFollowUpFields = [{ key: 'repairsRequired', label: 'Repairs Required' }, { key: 'urgentSafetyIssues', label: 'Urgent Safety Issues' }, { key: 'maintenanceScheduled', label: 'Maintenance Scheduled' }];


// Main Page Component
export default function ViewInspectionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  const firestore = useFirestore();
  const { user } = useUser();

  const inspectionRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !id || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'inspections', id);
  }, [firestore, propertyId, id, user]);
  const { data: inspection, isLoading: isLoadingInspection, error: inspectionError } = useDoc(inspectionRef);
  
  const propertyRef = useMemoFirebase(() => {
    if(!firestore || !propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);


  const generatePDF = () => {
    if (!inspection || !property) return;

    const doc = new jsPDF();
    const inspectionDate = inspection.scheduledDate?.seconds ? format(new Date(inspection.scheduledDate.seconds * 1000), 'PPP') : 'N/A';
    const inspectionType = inspection.type || 'N/A';
    const pageHeight = doc.internal.pageSize.getHeight();
    let finalY = 0;
    const propertyAddress = formatAddress(property.address);

    // --- HEADER ---
    doc.setFontSize(20);
    doc.text('Inspection Report', 14, 22);
    doc.setFontSize(12);
    doc.text(`Property: ${propertyAddress}`, 14, 30);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 200, 32);

    // --- SUMMARY TABLE ---
    doc.autoTable({
        startY: 35,
        head: [['Date', 'Inspector', 'Type', 'Status']],
        body: [[
            inspectionDate,
            inspection.inspectorName || 'N/A',
            inspectionType,
            inspection.status || 'N/A'
        ]],
        theme: 'striped',
        headStyles: { fillColor: [38, 102, 114] } 
    });

    finalY = (doc as any).lastAutoTable.finalY + 15;

    // --- HELPER TO ADD A SECTION ---
    const addSectionToPdf = (title: string, data: any, fields: {key: string, label: string}[], notesKey: string, concernsNote: string | null = null) => {
        if (!data && !concernsNote) return;

        const hasData = data && (fields.some(field => data[field.key] !== undefined && data[field.key] !== false && data[field.key] !== '') || data[notesKey]);
        if (!hasData && !concernsNote) return;

        // Check if we need a new page
        if (finalY > pageHeight - 60) { // Margin for content and footer
            doc.addPage();
            finalY = 20; // Reset Y for new page
        }

        doc.setFontSize(16);
        doc.text(title, 14, finalY);
        finalY += 8;

        if (fields && data) {
            const tableBody = fields.map(field => {
                const checked = data[field.key];
                const status = checked === true ? 'Pass' : (checked === false ? 'Fail' : 'N/A');
                return [field.label, status];
            });

            if (tableBody.some(row => row[1] !== 'N/A')) {
                doc.autoTable({
                    startY: finalY,
                    head: [['Checklist Item', 'Status']],
                    body: tableBody.filter(row => row[1] !== 'N/A'),
                    theme: 'grid'
                });
                finalY = (doc as any).lastAutoTable.finalY;
            }
        }

        const notes = data?.[notesKey];
        if (notes) {
            finalY += 8;
            doc.setFontSize(11);
            doc.text('Notes:', 15, finalY);
            finalY += 6;
            doc.setFontSize(10);
            const splitNotes = doc.splitTextToSize(notes, 170);
            doc.text(splitNotes, 15, finalY);
            finalY += (splitNotes.length * 4); // Adjust line height factor
        }
        
        if (concernsNote) {
            finalY += 8;
            doc.setFontSize(11);
            doc.text("Tenant's Concerns Recorded:", 15, finalY);
            finalY += 6;
            doc.setFontSize(10);
            const splitNotes = doc.splitTextToSize(concernsNote, 170);
            doc.text(splitNotes, 15, finalY);
            finalY += (splitNotes.length * 4);
        }

        finalY += 10; // Spacing after section
    };

    // --- RENDER SECTIONS BASED ON TYPE ---
    if (inspection.type === 'Single-Let') {
        Object.entries(singleLetSections).forEach(([key, { title, fields }]) => {
            addSectionToPdf(title, inspection[key], fields, 'notes');
        });
        addSectionToPdf(
            "Tenant Responsibilities", 
            inspection.tenantResponsibilities, 
            tenantResponsibilitiesFields, 
            'notes',
            inspection.tenantResponsibilities?.concerns
        );
        addSectionToPdf("Follow-Up Actions", inspection.followUpActions, followUpFields, 'notes');

    } else if (inspection.type === 'HMO') {
         Object.entries(hmoSections).forEach(([key, { title, fields }]) => {
            addSectionToPdf(title, inspection[key], fields, 'notes');
        });
        addSectionToPdf(
            "Tenant Responsibilities", 
            inspection.tenantResponsibilities, 
            hmoTenantFields, 
            'notes',
            inspection.tenantResponsibilities?.concerns
        );
        addSectionToPdf("Follow-Up Actions", inspection.followUp, hmoFollowUpFields, 'notes');

        const nextInspectionDate = inspection.followUp?.nextInspectionDate?.seconds ? format(new Date(inspection.followUp.nextInspectionDate.seconds * 1000), 'PPP') : null;
        if (nextInspectionDate) {
            finalY += 5;
            doc.setFontSize(12);
            doc.setTextColor(255, 165, 0); // Orange color for warning
            doc.text(`Next inspection recommended for: ${nextInspectionDate}`, 14, finalY);
            doc.setTextColor(0, 0, 0);
        }
    }

    // --- FOOTER ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
        doc.text(`Report generated on: ${format(new Date(), 'PPP')}`, 14, 287);
    }
    
    // --- SAVE ---
    const safeAddress = propertyAddress.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    doc.save(`Inspection-Report-${safeAddress}.pdf`);
  };


  const isLoading = isLoadingInspection || isLoadingProperty;

  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading inspection report...</p>
      </div>
    );
  }

  if (inspectionError || !propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
        <h2 className="text-lg font-bold">Failed to Load Inspection</h2>
        <p className="text-sm text-muted-foreground max-w-xs">There was an error loading the record details. Ensure the URL is correct.</p>
        <Button asChild variant="outline"><Link href="/dashboard/inspections">Return to Inspections</Link></Button>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6 p-6 text-center">
        <div className="bg-muted p-6 rounded-full">
          <CalendarIcon className="h-12 w-12 text-muted-foreground opacity-20" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Inspection Report Not Found</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">This inspection record may have been deleted, or you might be accessing a link without the required property context.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/inspections">Return to Inspections</Link>
        </Button>
      </div>
    );
  }
  
  const inspectionDate = inspection.scheduledDate?.seconds ? format(new Date(inspection.scheduledDate.seconds * 1000), 'PPP') : 'N/A';
  const nextInspectionDate = inspection.followUp?.nextInspectionDate?.seconds ? format(new Date(inspection.followUp.nextInspectionDate.seconds * 1000), 'PPP') : null;
  const propertyAddress = property ? formatAddress(property.address) : 'Property Context Missing';


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/inspections"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold">Inspection Report</h1>
                <p className="text-muted-foreground">{propertyAddress}</p>
            </div>
        </div>
        <Button onClick={generatePDF} disabled={!inspection || !property}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Inspection Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
                <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">Inspection Date</p>
                    <p>{inspectionDate}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <User className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">Inspector</p>
                    <p>{inspection.inspectorName || 'N/A'}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <Shield className="h-5 w-5 text-muted-foreground mt-1" />
                <div>
                    <p className="text-sm text-muted-foreground">Inspection Type</p>
                    <p>{inspection.type}</p>
                </div>
            </div>
             <div className="flex items-start gap-4">
                <Badge>{inspection.status}</Badge>
            </div>
        </CardContent>
      </Card>
      
      <div className="space-y-6">
        {inspection.type === 'Single-Let' && (
            <>
                {Object.entries(singleLetSections).map(([key, { title, fields }]) => (
                    <InspectionSection key={key} title={title} data={inspection[key]} fields={fields} />
                ))}
                <InspectionSection title="Tenant Responsibilities" data={inspection.tenantResponsibilities} fields={tenantResponsibilitiesFields} />
                <NotesDisplay title="Tenant's Concerns Recorded" notes={inspection.tenantResponsibilities?.concerns} />
                <InspectionSection title="Follow-Up Actions" data={inspection.followUpActions} fields={followUpFields} notesKey="notes"/>
            </>
        )}
        
        {inspection.type === 'HMO' && (
             <>
                {Object.entries(hmoSections).map(([key, { title, fields }]) => (
                    <InspectionSection key={key} title={title} data={inspection[key]} fields={fields} />
                ))}
                <InspectionSection title="Tenant Responsibilities" data={inspection.tenantResponsibilities} fields={hmoTenantFields} />
                 <NotesDisplay title="Tenant's Concerns Recorded" notes={inspection.tenantResponsibilities?.concerns} />
                <InspectionSection title="Follow-Up Actions" data={inspection.followUp} fields={hmoFollowUpFields} />
                {nextInspectionDate && (
                    <Card>
                        <CardHeader className="flex flex-row items-center gap-4">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            <CardTitle className="text-lg">Next Inspection Recommended</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p>Next inspection is recommended for: <strong>{nextInspectionDate}</strong></p>
                        </CardContent>
                    </Card>
                )}
            </>
        )}
      </div>

    </div>
  );
}
