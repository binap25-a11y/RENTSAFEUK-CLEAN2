'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, FileWarning, CalendarClock, Activity } from 'lucide-react';
import { format, isBefore, addDays, isFuture } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, Timestamp, onSnapshot, limit } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
}

interface Document {
  id: string;
  title: string;
  propertyId: string;
  expiryDate: Timestamp | Date | { seconds: number; nanoseconds: number };
  documentType: string;
}

interface Inspection {
  id: string;
  propertyId: string;
  inspectionType?: string;
  type: string;
  status: string;
  scheduledDate: Timestamp | Date | { seconds: number; nanoseconds: number };
}

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const getDocumentStatus = (expiryDate: Date, today: Date) => {
  const ninetyDaysFromNow = addDays(today, 90);
  if (isBefore(expiryDate, today)) return 'Expired';
  if (isBefore(expiryDate, ninetyDaysFromNow)) return 'Expiring Soon';
  return 'Valid';
};

const getStatusVariant = (status: string): "destructive" | "secondary" | "outline" => {
  switch (status) {
    case 'Expired': return 'destructive';
    case 'Expiring Soon':
    case 'Scheduled': return 'secondary';
    default: return 'outline';
  }
};

export default function RemindersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => { setToday(new Date()); }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'userProfiles', user.uid, 'properties'), where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']));
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);

  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) {
        setAllDocuments([]);
        setAllInspections([]);
        return;
    }

    setIsAggregating(true);
    const unsubs: (() => void)[] = [];
    const docMap: Record<string, Document[]> = {};
    const inspMap: Record<string, Inspection[]> = {};

    const updateState = () => {
        setAllDocuments(Object.values(docMap).flat());
        setAllInspections(Object.values(inspMap).flat());
        setIsAggregating(false);
    };

    properties.forEach(prop => {
        // Listen to Documents
        unsubs.push(onSnapshot(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'documents'), (snap) => {
            docMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
            updateState();
        }));
        // Listen to Inspections
        unsubs.push(onSnapshot(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'inspections'), (snap) => {
            inspMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Inspection));
            updateState();
        }));
    });

    return () => unsubs.forEach(u => u());
  }, [user, properties, firestore]);

  const propertyMap = useMemo(() => {
    return properties?.reduce((map, prop) => {
      map[prop.id] = prop.address ? [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ') : 'Unknown';
      return map;
    }, {} as Record<string, string>) ?? {};
  }, [properties]);

  const allReminders = useMemo(() => {
    if (!today) return [];
    const documentReminders = allDocuments
        .map((doc) => {
          const expiry = toDate(doc.expiryDate);
          if (!expiry) return null;
          return { ...doc, expiryDate: expiry, status: getDocumentStatus(expiry, today) };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null && doc.status !== 'Valid')
        .map((doc) => ({ id: `doc-${doc.id}`, type: 'Compliance', description: doc.title, category: doc.documentType, property: propertyMap[doc.propertyId] || 'Unknown', dueDate: doc.expiryDate, status: doc.status, href: `/dashboard/documents?propertyId=${doc.propertyId}` }));

    const inspectionReminders = allInspections
        .map((insp) => {
          const scheduled = toDate(insp.scheduledDate);
          if (!scheduled || insp.status !== 'Scheduled') return null;
          return { ...insp, scheduledDate: scheduled };
        })
        .filter((insp): insp is NonNullable<typeof insp> => insp !== null && isFuture(insp.scheduledDate))
        .map((insp) => ({ id: `insp-${insp.id}`, type: 'Task', description: insp.inspectionType || insp.type || 'Inspection', category: 'Routine Check', property: propertyMap[insp.propertyId] || 'Unknown', dueDate: insp.scheduledDate, status: 'Scheduled', href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}` }));

    return [...documentReminders, ...inspectionReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, propertyMap, today]);
  
  const generateComplianceReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text('Portfolio Compliance Health Report', 14, 22);
    doc.setFontSize(10); doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
    const complianceData = allReminders.map(r => [r.property, r.category, r.description, format(r.dueDate, 'dd/MM/yyyy'), r.status]);
    (doc as any).autoTable({ startY: 40, head: [['Property', 'Compliance Area', 'Details', 'Due Date', 'Status']], body: complianceData, theme: 'grid', headStyles: { fillColor: [38, 102, 114] } });
    doc.save('Portfolio-Compliance-Health.pdf');
  };

  const urgentCount = useMemo(() => allReminders.filter(r => r.status === 'Expired').length, [allReminders]);
  const upcomingCount = useMemo(() => allReminders.filter(r => r.status !== 'Expired').length, [allReminders]);
  const isLoading = isLoadingProps || isAggregating || !today;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Urgent Compliance</CardTitle><FileWarning className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : urgentCount}</div><p className="text-xs text-muted-foreground">Expired documents</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Upcoming Schedule</CardTitle><CalendarClock className="h-4 w-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : upcomingCount}</div><p className="text-xs text-muted-foreground">Tasks next 90 days</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start"><div><CardTitle>Portfolio Reminders</CardTitle><CardDescription>Upcoming compliance and maintenance tasks.</CardDescription></div><Button onClick={generateComplianceReport} disabled={isLoading} className="w-full sm:w-auto"><Activity className="mr-2 h-4 w-4" /> Compliance Health PDF</Button></div></CardHeader>
        <CardContent>
          {isLoading ? ( <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> ) : allReminders.length === 0 ? ( <div className="h-48 text-center flex flex-col justify-center items-center text-muted-foreground italic border-2 border-dashed rounded-lg"><CalendarClock className="h-10 w-10 opacity-10 mb-2" /><p>You're all caught up!</p></div> ) : (
            <div className="rounded-md border overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50"><TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Property</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Due Date</TableHead></TableRow></TableHeader>
                    <TableBody>{allReminders.map((reminder) => (<TableRow key={reminder.id} className="hover:bg-muted/30 transition-colors"><TableCell><Badge variant="outline">{reminder.type}</Badge></TableCell><TableCell className="font-semibold"><Link href={reminder.href} className="hover:underline">{reminder.description}</Link></TableCell><TableCell className="text-sm">{reminder.property}</TableCell><TableCell><Badge variant={getStatusVariant(reminder.status)}>{reminder.status}</Badge></TableCell><TableCell className="text-right font-medium">{format(reminder.dueDate, 'dd/MM/yyyy')}</TableCell></TableRow>))}</TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
