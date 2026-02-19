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
import { Download, Loader2, FileWarning, CalendarClock } from 'lucide-react';
import { format, isBefore, addDays, isFuture } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, Timestamp, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend the autoTable interface in jsPDF
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

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

  useEffect(() => {
    setToday(new Date());
  }, []);

  // Primary Properties Listener
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);

  // Manual Aggregation Effect
  useEffect(() => {
    if (!user || !properties || properties.length === 0) {
        setAllDocuments([]);
        setAllInspections([]);
        return;
    }

    const fetchAggregates = async () => {
        setIsAggregating(true);
        try {
            const docPromises: Promise<any>[] = [];
            const inspPromises: Promise<any>[] = [];

            properties.forEach(prop => {
                const ownerFilter = where('ownerId', '==', user.uid);
                docPromises.push(getDocs(query(collection(firestore, 'properties', prop.id, 'documents'), ownerFilter)));
                inspPromises.push(getDocs(query(collection(firestore, 'properties', prop.id, 'inspections'), ownerFilter)));
            });

            const [docSnaps, inspSnaps] = await Promise.all([
                Promise.all(docPromises),
                Promise.all(inspPromises)
            ]);

            setAllDocuments(docSnaps.flatMap(snap => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Document))));
            setAllInspections(inspSnaps.flatMap(snap => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Inspection))));
        } catch (err) {
            console.error("Aggregation failed:", err);
        } finally {
            setIsAggregating(false);
        }
    };

    fetchAggregates();
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
        .map((doc) => ({
          id: `doc-${doc.id}`,
          type: 'Compliance',
          description: doc.title,
          property: propertyMap[doc.propertyId] || 'Unknown Property',
          dueDate: doc.expiryDate,
          status: doc.status,
          href: '/dashboard/documents'
        }));

    const inspectionReminders = allInspections
        .map((insp) => {
          const scheduled = toDate(insp.scheduledDate);
          if (!scheduled || insp.status !== 'Scheduled') return null;
          return { ...insp, scheduledDate: scheduled };
        })
        .filter((insp): insp is NonNullable<typeof insp> => insp !== null && isFuture(insp.scheduledDate))
        .map((insp) => ({
          id: `insp-${insp.id}`,
          type: 'Task',
          description: insp.inspectionType || insp.type || 'Inspection',
          property: propertyMap[insp.propertyId] || 'Unknown Property',
          dueDate: insp.scheduledDate,
          status: 'Scheduled',
          href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}`
        }));

    return [...documentReminders, ...inspectionReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, propertyMap, today]);
  
  const urgentCount = useMemo(() => allReminders.filter(r => r.status === 'Expired').length, [allReminders]);
  const upcomingCount = useMemo(() => allReminders.filter(r => r.status !== 'Expired').length, [allReminders]);

  const isLoading = isLoadingProps || isAggregating || !today;

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Compliance and Task Reminders', 14, 22);
    const tableColumn = ['Type', 'Description', 'Property', 'Due Date', 'Status'];
    const tableRows = allReminders.map(r => [r.type, r.description, r.property, format(r.dueDate, 'dd/MM/yyyy'), r.status]);
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 30, theme: 'striped' });
    doc.save('portfolio-reminders.pdf');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Urgent Compliance</CardTitle>
            <FileWarning className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : urgentCount}</div>
            <p className="text-xs text-muted-foreground">Expired documents needing action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Schedule</CardTitle>
            <CalendarClock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : upcomingCount}</div>
            <p className="text-xs text-muted-foreground">Tasks due in the next 90 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <CardTitle>Portfolio Reminders</CardTitle>
              <CardDescription>A consolidated list of all upcoming compliance and maintenance tasks.</CardDescription>
            </div>
            <Button onClick={exportToPDF} disabled={isLoading || allReminders.length === 0} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" /> Export Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : allReminders.length === 0 ? (
            <div className="h-48 text-center flex flex-col justify-center items-center text-muted-foreground italic">
                <p>You're all caught up!</p>
                <p className="text-sm">No pending compliance or scheduled tasks found.</p>
            </div>
          ) : (
            <div className="space-y-4">
                <div className="hidden md:block border rounded-md overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Property</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Due Date</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {allReminders.map((reminder) => (
                                <TableRow key={reminder.id}>
                                    <TableCell><Badge variant="outline">{reminder.type}</Badge></TableCell>
                                    <TableCell className="font-semibold"><Link href={reminder.href} className="hover:underline">{reminder.description}</Link></TableCell>
                                    <TableCell className="text-sm">{reminder.property}</TableCell>
                                    <TableCell><Badge variant={getStatusVariant(reminder.status)}>{reminder.status}</Badge></TableCell>
                                    <TableCell className="text-right font-medium">{format(reminder.dueDate, 'dd/MM/yyyy')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <div className="grid gap-4 md:hidden">
                    {allReminders.map((reminder) => (
                        <Card key={reminder.id} className="relative overflow-hidden">
                            <Link href={reminder.href} className="block p-4">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                    <Badge variant={getStatusVariant(reminder.status)}>{reminder.status}</Badge>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{reminder.type}</span>
                                </div>
                                <p className="font-bold text-lg mb-1">{reminder.description}</p>
                                <p className="text-sm text-muted-foreground mb-3">{reminder.property}</p>
                                <div className="pt-2 border-t flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Deadline</span>
                                    <span className="font-bold">{format(reminder.dueDate, 'PPP')}</span>
                                </div>
                            </Link>
                        </Card>
                    ))}
                </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
