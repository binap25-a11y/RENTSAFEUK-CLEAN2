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
import { PlusCircle, Loader2, Eye, CalendarCheck } from 'lucide-react';
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
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
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

  // Safe date formatting helper to prevent RangeError
  const safeFormatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    try {
      let d: Date;
      if (dateValue instanceof Date) {
        d = dateValue;
      } else if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
        d = new Date(dateValue.seconds * 1000);
      } else {
        d = new Date(dateValue);
      }
      
      if (isNaN(d.getTime())) return 'Invalid Date';
      return format(d, 'PPP');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <CalendarCheck className="h-6 w-6" />
            <h1 className="text-3xl font-bold font-headline tracking-tight">Property Inspections</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-3xl">
            Streamline your portfolio management with digital walk-throughs. Choose a report type below to start recording findings.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <Button asChild size="lg" className="shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Link href="/dashboard/inspections/single-let">
              <PlusCircle className="mr-2 h-5 w-5" /> Start Single-Let Inspection
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-background">
            <Link href="/dashboard/inspections/hmo">
              <PlusCircle className="mr-2 h-5 w-5" /> Start HMO Inspection
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="border-b bg-muted/30 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <CardTitle>Inspection History</CardTitle>
              <CardDescription>
                Filter and view records from previous property checks.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Label htmlFor="property-filter" className="text-sm font-semibold whitespace-nowrap">
                Property
              </Label>
              <Select
                onValueChange={setSelectedPropertyId}
                value={selectedPropertyId}
              >
                <SelectTrigger
                  id="property-filter"
                  className="w-full md:w-[320px] bg-background"
                >
                  <SelectValue
                    placeholder={
                      isLoadingProperties
                        ? 'Loading properties...'
                        : 'Select a property to view logs'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {properties?.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {[prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingInspections ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              </div>
          ) : !inspections?.length ? (
              <div className="text-center py-20 px-6 text-muted-foreground">
                <div className="bg-muted/50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                  <CalendarCheck className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
                  {selectedPropertyId ? 'No inspection records found.' : 'Select a property above'}
                </p>
                <p className="text-sm">
                  {selectedPropertyId 
                    ? 'Start a new inspection using the buttons above to populate this list.' 
                    : 'Choose a property from your portfolio to see its history.'}
                </p>
              </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-6">Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Inspection Date</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections?.map((inspection) => (
                    <TableRow key={inspection.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold pl-6">
                        {inspection.type}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(inspection.status)} className="capitalize">
                          {inspection.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {safeFormatDate(inspection.scheduledDate)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                          <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                              <Link href={`/dashboard/inspections/${inspection.id}?propertyId=${selectedPropertyId}`}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                              </Link>
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}