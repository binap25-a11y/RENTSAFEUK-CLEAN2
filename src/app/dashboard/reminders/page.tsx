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
import { Download, Loader2 } from 'lucide-react';
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

const getStatusVariant = (status: string) => {
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
      const docs: Document[] = [];
      const insps: Inspection[] = [];

      for (const prop of properties) {
        const docsQuery = query(collection(firestore, 'properties', prop.id, 'documents'));
        const inspsQuery = query(collection(firestore, 'properties', prop.id, 'inspections'));
        
        const [docsSnapshot, inspsSnapshot] = await Promise.all([
            getDocs(docsQuery),
            getDocs(inspsQuery)
        ]);

        docsSnapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() } as Document));
        inspsSnapshot.forEach(doc => insps.push({ id: doc.id, ...doc.data() } as Inspection));
      }
      
      setAllDocuments(docs);
      setAllInspections(insps);
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Reminders</CardTitle>
              <CardDescription>
                A consolidated list of upcoming document expiries and tasks.
              </CardDescription>
            </div>
            <Button
              onClick={exportToPDF}
              disabled={isLoading || allReminders.length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> Export to PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
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
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && allReminders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No reminders at the moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  !isLoading &&
                  allReminders.map((reminder) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
