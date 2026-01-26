'use client';

import { useMemo } from 'react';
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
import { collection, collectionGroup, query, where } from 'firebase/firestore';

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

  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } =
    useCollection<Property>(propertiesQuery);

  const documentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'documents'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: documents, isLoading: isLoadingDocuments } =
    useCollection<Document>(documentsQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'inspections'),
      where('ownerId', '==', user.uid),
      where('status', '==', 'Scheduled')
    );
  }, [firestore, user]);
  const { data: inspections, isLoading: isLoadingInspections } =
    useCollection<Inspection>(inspectionsQuery);

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
      documents
        ?.map((doc) => {
          const expiry =
            doc.expiryDate instanceof Date
              ? doc.expiryDate
              : new Date(doc.expiryDate.seconds * 1000);
          return {
            ...doc,
            expiryDate: expiry,
            status: getDocumentStatus(expiry),
          };
        })
        .filter(
          (doc) => doc.status === 'Expired' || doc.status === 'Expiring Soon'
        )
        .map((doc) => ({
          id: `doc-${doc.id}`,
          type: 'Document',
          description: doc.title,
          property: propertyMap[doc.propertyId] || 'Unknown Property',
          dueDate: doc.expiryDate,
          status: doc.status,
        })) ?? [];

    const inspectionReminders =
      inspections
        ?.filter((insp) => {
          const scheduled =
            insp.scheduledDate instanceof Date
              ? insp.scheduledDate
              : new Date(insp.scheduledDate.seconds * 1000);
          return isFuture(scheduled);
        })
        .map((insp) => ({
          id: `insp-${insp.id}`,
          type: 'Task',
          description: insp.inspectionType || insp.type || 'Inspection',
          property: propertyMap[insp.propertyId] || 'Unknown Property',
          dueDate:
            insp.scheduledDate instanceof Date
              ? insp.scheduledDate
              : new Date(insp.scheduledDate.seconds * 1000),
          status: 'Scheduled',
        })) ?? [];

    return [...documentReminders, ...inspectionReminders].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }, [documents, inspections, propertyMap]);

  const isLoading =
    isLoadingProperties || isLoadingDocuments || isLoadingInspections;

  const exportToPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

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
