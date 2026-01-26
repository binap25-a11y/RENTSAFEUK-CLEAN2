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
import { PlusCircle } from 'lucide-react';
import { pastInspections } from '@/data/mock-data';
import { format } from 'date-fns';

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Scheduled':
      return 'secondary';
    case 'Completed':
      return 'default';
    default:
      return 'outline';
  }
};

export default function InspectionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Property Inspections</h1>
        <p className="text-muted-foreground">
          View past inspections and create new ones.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild>
          <Link href="/dashboard/inspections/single-let">
            <PlusCircle className="mr-2 h-4 w-4" /> New Single-Let Inspection
          </Link>
        </Button>
          <Button asChild variant="outline">
          <Link href="/dashboard/inspections/hmo">
            <PlusCircle className="mr-2 h-4 w-4" /> New HMO Inspection
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Previous Inspections</CardTitle>
          <CardDescription>
            A log of all completed and scheduled inspections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastInspections.map((inspection) => (
                  <TableRow key={inspection.id}>
                    <TableCell className="font-medium">{inspection.property}</TableCell>
                    <TableCell>{inspection.type}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(inspection.status)}>{inspection.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{format(new Date(inspection.date), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
