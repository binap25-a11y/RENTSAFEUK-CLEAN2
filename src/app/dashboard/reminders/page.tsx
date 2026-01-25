'use client';

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
import { Download } from 'lucide-react';
import { documents, upcomingTasks } from '@/data/mock-data';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend the autoTable interface in jsPDF
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Expired':
    case 'Due':
      return 'destructive';
    case 'Expiring Soon':
    case 'Pending':
      return 'secondary';
    default:
      return 'outline';
  }
};

export default function RemindersPage() {
  const documentReminders = documents.filter(
    (doc) => doc.status === 'Expired' || doc.status === 'Expiring Soon'
  ).map(doc => ({
    id: `doc-${doc.id}`,
    type: 'Document',
    description: doc.title,
    property: doc.property,
    dueDate: doc.expiryDate,
    status: doc.status,
  }));

  const inspectionReminders = upcomingTasks.map(task => ({
      id: `task-${task.id}`,
      type: 'Task',
      description: task.task,
      property: task.property,
      dueDate: task.dueDate,
      status: task.status,
  }));

  const allReminders = [...documentReminders, ...inspectionReminders].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Compliance and Task Reminders', 14, 22);

    const tableColumn = ["Type", "Description", "Property", "Due Date", "Status"];
    const tableRows: (string | null)[][] = [];

    allReminders.forEach(reminder => {
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
            <Button onClick={exportToPDF}>
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
                {allReminders.length > 0 ? (
                    allReminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                        <TableCell>{reminder.type}</TableCell>
                        <TableCell className="font-medium">{reminder.description}</TableCell>
                        <TableCell>{reminder.property}</TableCell>
                        <TableCell>
                        <Badge variant={getStatusVariant(reminder.status)}>{reminder.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{format(new Date(reminder.dueDate), 'dd/MM/yyyy')}</TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            No reminders at the moment.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
