'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
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
import { PlusCircle, Loader2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// Type for property documents from Firestore
interface Property {
  id: string;
  address: string;
}

// Type for inspection documents from Firestore
interface Inspection {
  id: string;
  propertyId: string;
  type: string;
  status: string;
  scheduledDate: { seconds: number; nanoseconds: number } | Date;
}

const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" | null | undefined => {
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
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Fetch properties for the filter dropdown
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } =
    useCollection<Property>(propertiesQuery);

  // Fetch inspections for the selected property
  const inspectionsQuery = useMemoFirebase(() => {
    if (!user || !selectedPropertyId) return null;
    return query(
      collection(firestore, 'properties', selectedPropertyId, 'inspections'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyId]);

  const { data: inspections, isLoading: isLoadingInspections } =
    useCollection<Inspection>(inspectionsQuery);

  const getPropertyAddress = (propertyId: string) => {
    return properties?.find((p) => p.id === propertyId)?.address || 'Unknown';
  };

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
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="property-filter" className="whitespace-nowrap">
              Filter by Property
            </Label>
            <Select
              onValueChange={setSelectedPropertyId}
              value={selectedPropertyId}
            >
              <SelectTrigger
                id="property-filter"
                className="w-full md:w-[300px]"
              >
                <SelectValue
                  placeholder={
                    isLoadingProperties
                      ? 'Loading...'
                      : 'Select a property to view inspections'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {isLoadingInspections ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
              </div>
          ) : !inspections?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                {selectedPropertyId
                  ? 'No inspections found for this property.'
                  : 'Select a property to see inspections.'}
              </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inspections?.map((inspection) => (
                      <TableRow key={inspection.id}>
                        <TableCell className="font-medium">
                          {getPropertyAddress(inspection.propertyId)}
                        </TableCell>
                        <TableCell>{inspection.type}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(inspection.status)}>
                            {inspection.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(
                            inspection.scheduledDate instanceof Date
                              ? inspection.scheduledDate
                              : new Date(inspection.scheduledDate.seconds * 1000),
                            'dd/MM/yyyy'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button asChild variant="outline" size="icon">
                                <Link href={`/dashboard/properties/${inspection.propertyId}/inspections/${inspection.id}`}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">View Inspection</span>
                                </Link>
                            </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile Card View */}
              <div className="grid gap-4 md:hidden">
                {inspections.map((inspection) => (
                    <Card key={inspection.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className='text-base'>{getPropertyAddress(inspection.propertyId)}</CardTitle>
                                <CardDescription>{inspection.type}</CardDescription>
                            </div>
                            <Button asChild variant="outline" size="sm">
                                <Link href={`/dashboard/properties/${inspection.propertyId}/inspections/${inspection.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                </Link>
                            </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm pt-0">
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant={getStatusVariant(inspection.status)}>
                                    {inspection.status}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className="text-muted-foreground">Date</span>
                                <span className='font-medium'>{format(
                                    inspection.scheduledDate instanceof Date
                                    ? inspection.scheduledDate
                                    : new Date(inspection.scheduledDate.seconds * 1000),
                                    'dd/MM/yyyy'
                                )}</span>
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
