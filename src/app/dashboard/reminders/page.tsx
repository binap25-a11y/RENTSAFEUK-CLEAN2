'use client';

import { useMemo } from 'react';
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
import { collection, query, where, Timestamp, collectionGroup } from 'firebase/firestore';
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
  expiryDate: Timestamp | Date;
}

interface Inspection {
  id: string;
  propertyId: string;
  inspectionType?: string;
  type: string;
  status: string;
  scheduledDate: Timestamp | Date;
}

const getDocumentStatus = (expiryDate: Date) => {
  const today = new Date();
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

  // Simplified filters to avoid index requirement
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collectionGroup(firestore, 'documents'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: allDocuments, isLoading: isLoadingDocs } = useCollection<Document>(docsQuery);

  const inspsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collectionGroup(firestore, 'inspections'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: allInspections, isLoading: isLoadingInsps } = useCollection<Inspection>(inspsQuery);

  const propertyMap = useMemo(() => {
    return properties?.reduce((map, prop) => {
      map[prop.id] = prop.address ? [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ') : 'Unknown';
      return map;
    }, {} as Record<string, string>) ?? {};
  }, [properties]);

  const allReminders = useMemo(() => {
    const documentReminders = allDocuments
        ?.map((doc) => {
          const expiry = doc.expiryDate instanceof Date ? doc.expiryDate : (doc.expiryDate as Timestamp).toDate();
          return { ...doc, expiryDate: expiry, status: getDocumentStatus(expiry) };
        })
        .filter(doc => doc.status !== 'Valid')
        .map((doc) => ({
          id: `doc-${doc.id}`,
          type: 'Compliance',
          description: doc.title,
          property: propertyMap[doc.propertyId] || 'Unknown Property',
          dueDate: doc.expiryDate,
          status: doc.status,
          href: '/dashboard/documents'
        })) ?? [];

    const inspectionReminders = allInspections
        ?.filter(insp => insp.status === 'Scheduled')
        .map((insp) => {
          const scheduled = insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate();
          return { ...insp, scheduledDate: scheduled };
        })
        .filter(insp => isFuture(insp.scheduledDate))
        .map((insp) => ({
          id: `insp-${insp.id}`,
          type: 'Task',
          description: insp.inspectionType || insp.type || 'Inspection',
          property: propertyMap[insp.propertyId] || 'Unknown Property',
          dueDate: insp.scheduledDate,
          status: 'Scheduled',
          href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}`
        })) ?? [];

    return [...documentReminders, ...inspectionReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, propertyMap]);
  
  const urgentCount = useMemo(() => allReminders.filter(r => r.status === 'Expired').length, [allReminders]);
  const upcomingCount = useMemo(() => allReminders.filter(r => r.status !== 'Expired').length, [allReminders]);

  const isLoading = isLoadingProps || isLoadingDocs || isLoadingInsps;

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
