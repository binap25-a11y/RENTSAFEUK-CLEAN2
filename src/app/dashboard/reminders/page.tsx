'use client';

import { useMemo, useState, useEffect } from 'react';
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
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
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
  address: string;
}

interface Document {
  id: string;
  title: string;
  propertyId: string;
  expiryDate: { seconds: number; nanoseconds: number } | Date;
}

interface Inspection {
  id: string;
  propertyId: string;
  inspectionType?: string;
  type: string;
  status: string;
  scheduledDate: { seconds: number; nanoseconds: number } | Date;
}

const getDocumentStatus = (expiryDate: Date) => {
  const today = new Date();
  const ninetyDaysFromNow = addDays(today, 90);

  if (isBefore(expiryDate, today)) {
    return 'Expired';
  }
  if (isBefore(expiryDate, ninetyDaysFromNow)) {
    return 'Expiring Soon';
  }
  return 'Valid';
};

const getStatusVariant = (status: string): "destructive" | "secondary" | "outline" => {
  switch (status) {
    case 'Expired':
      return 'destructive';
    case 'Expiring Soon':
    case 'Scheduled':
      return 'secondary';
    default:
      return 'outline';
  }
};

export default function RemindersPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  useEffect(() => {
    if (!firestore || !user || !properties) {
        if (!isLoadingProperties) {
            setIsLoadingReminders(false);
        }
        return;
    };

    const fetchSubcollections = async () => {
      setIsLoadingReminders(true);

      const promises = properties.map(async (prop) => {
        const docsQuery = query(collection(firestore, 'properties', prop.id, 'documents'));
        const inspsQuery = query(collection(firestore, 'properties', prop.id, 'inspections'));
        
        const [docsSnapshot, inspsSnapshot] = await Promise.all([
            getDocs(docsQuery),
            getDocs(inspsQuery)
        ]);

        const docs = docsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, propertyId: prop.id } as Document));
        const insps = inspsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, propertyId: prop.id } as Inspection));
        return { docs, insps };
      });
      
      const results = await Promise.all(promises);

      setAllDocuments(results.flatMap(r => r.docs));
      setAllInspections(results.flatMap(r => r.insps));
      setIsLoadingReminders(false);
    };

    if (properties.length > 0) {
        fetchSubcollections();
    } else {
        setIsLoadingReminders(false);
    }
  }, [firestore, user, properties, isLoadingProperties]);


  const propertyMap = useMemo(() => {
    return (
      properties?.reduce((map, prop) => {
        map[prop.id] = prop.address;
        return map;
      }, {} as Record<string, string>) ?? {}
    );
  }, [properties]);

  const allReminders = useMemo(() => {
    const documentReminders =
      allDocuments
        ?.map((doc) => {
          if (!doc.expiryDate) return null;
          const expiry =
            doc.expiryDate instanceof Date
              ? doc.expiryDate
              : (doc.expiryDate as Timestamp).toDate();
          return {
            ...doc,
            expiryDate: expiry,
            status: getDocumentStatus(expiry),
          };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null && (doc.status === 'Expired' || doc.status === 'Expiring Soon'))
        .map((doc) => ({
          id: `doc-${doc.id}`,
          type: 'Document',
          description: doc.title,
          property: propertyMap[doc.propertyId] || 'Unknown Property',
          dueDate: doc.expiryDate,
          status: doc.status,
        })) ?? [];

    const inspectionReminders =
      allInspections
        ?.filter((insp) => {
          if (!insp.scheduledDate) return false;
          const scheduled =
            insp.scheduledDate instanceof Date
              ? insp.scheduledDate
              : (insp.scheduledDate as Timestamp).toDate();
          return insp.status === 'Scheduled' && isFuture(scheduled);
        })
        .map((insp) => ({
          id: `insp-${insp.id}`,
          type: 'Task',
          description: insp.inspectionType || insp.type || 'Inspection',
          property: propertyMap[insp.propertyId] || 'Unknown Property',
          dueDate:
            insp.scheduledDate instanceof Date
              ? insp.scheduledDate
              : (insp.scheduledDate as Timestamp).toDate(),
          status: 'Scheduled',
        })) ?? [];

    return [...documentReminders, ...inspectionReminders].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }, [allDocuments, allInspections, propertyMap]);
  
  const urgentCount = useMemo(() => allReminders.filter(r => r.status === 'Expired').length, [allReminders]);
  const upcomingCount = useMemo(() => allReminders.filter(r => r.status === 'Expiring Soon' || r.status === 'Scheduled').length, [allReminders]);


  const isLoading = isLoadingProperties || isLoadingReminders;

  const exportToPDF = async () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Compliance and Task Reminders', 14, 22);

    const tableColumn = [
      'Type',
      'Description',
      'Property',
      'Due Date',
      'Status',
    ];
    const tableRows: (string | null)[][] = [];

    allReminders.forEach((reminder) => {
      const reminderData = [
        reminder.type,
        reminder.description,
        reminder.property,
        format(new Date(reminder.dueDate), 'dd/MM/yyyy'),
        reminder.status,
      ];
      tableRows.push(reminderData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
    });

    doc.save('reminders.pdf');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Urgent Items</CardTitle>
            <FileWarning className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{isLoading ? '-' : urgentCount}</div>
            <p className="text-xs text-muted-foreground">Expired documents needing immediate action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Tasks</CardTitle>
            <CalendarClock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? '-' : upcomingCount}</div>
            <p className="text-xs text-muted-foreground">Documents expiring & scheduled tasks</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <CardTitle>All Reminders</CardTitle>
              <CardDescription>
                A consolidated list of upcoming document expiries and tasks.
              </CardDescription>
            </div>
            <Button
              onClick={exportToPDF}
              disabled={isLoading || allReminders.length === 0}
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" /> Export to PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
             </div>
          ) : allReminders.length === 0 ? (
            <div className="h-24 text-center flex justify-center items-center">
                No reminders at the moment.
            </div>
          ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {allReminders.map((reminder) => (
                      <TableRow key={reminder.id}>
                        <TableCell>{reminder.type}</TableCell>
                        <TableCell className="font-medium">
                          {reminder.description}
                        </TableCell>
                        <TableCell>{reminder.property}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(reminder.status)}>
                            {reminder.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {format(new Date(reminder.dueDate), 'dd/MM/yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="grid gap-4 md:hidden">
              {allReminders.map((reminder) => (
                <Card key={reminder.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-base">{reminder.description}</CardTitle>
                        <Badge variant={getStatusVariant(reminder.status)}>{reminder.status}</Badge>
                    </div>
                    <CardDescription>{reminder.property}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm pt-0">
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{reminder.type}</span>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-muted-foreground">Due</span>
                      <span className="font-medium">{format(new Date(reminder.dueDate), 'dd/MM/yyyy')}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
