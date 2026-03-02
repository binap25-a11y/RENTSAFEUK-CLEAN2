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
import {
  PlusCircle,
  Loader2,
  Eye,
  CalendarCheck,
  Filter,
  Edit,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, deleteDoc, limit } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

// Type for property documents from Firestore
interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
  status?: string;
}

// Type for inspection documents from Firestore
interface Inspection {
  id: string;
  propertyId: string;
  type: string;
  status: string;
  scheduledDate: { seconds: number; nanoseconds: number } | Date;
}

const getStatusVariant = (
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' | null | undefined => {
  switch (status) {
    case 'Scheduled':
      return 'secondary';
    case 'Completed':
      return 'default';
    case 'Cancelled':
      return 'destructive';
    default:
      return 'outline';
  }
};

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val)
    return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function InspectionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [inspectionToDelete, setInspectionToDelete] = useState<Inspection | null>(
    null
  );

  // Fetch properties - strictly scoped to logged-in user
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);
  const { data: allProperties, isLoading: isLoadingProperties } =
    useCollection<Property>(propertiesQuery);

  // Filter properties in-memory to show only "Active" ones
  const properties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status || '')) ?? [];
  }, [allProperties]);

  // Fetch inspections for the selected property - strictly scoped to logged-in user
  const inspectionsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedPropertyId) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties', selectedPropertyId, 'inspections'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user, selectedPropertyId]);

  const { data: inspections, isLoading: isLoadingInspections } =
    useCollection<Inspection>(inspectionsQuery);

  // Filter out deleted inspections
  const activeInspections = useMemo(() => {
    return inspections?.filter((i) => i.status !== 'Deleted') ?? [];
  }, [inspections]);

  // Safe date formatting helper to prevent RangeError
  const safeFormatDate = (dateValue: any) => {
    const d = toDate(dateValue);
    if (!d) return 'N/A';
    try {
        return format(d, 'PPP');
    } catch (e) {
        return 'Invalid Date';
    }
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !inspectionToDelete || !selectedPropertyId) return;
    try {
      const docRef = doc(
        firestore,
        'userProfiles',
        user.uid,
        'properties',
        selectedPropertyId,
        'inspections',
        inspectionToDelete.id
      );
      await deleteDoc(docRef);
      toast({
        title: 'Inspection Deleted',
        description: 'The inspection record has been permanently removed.',
      });
    } catch (e) {
      console.error('Error deleting inspection:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the inspection. Please try again.',
      });
    } finally {
      setInspectionToDelete(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <CalendarCheck className="h-6 w-6" />
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Property Inspections
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-3xl">
            Streamline your portfolio management with digital walk-throughs.
            Choose a report type below to start recording findings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <Button
            asChild
            size="lg"
            className="h-16 text-lg shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Link href="/dashboard/inspections/single-let">
              <PlusCircle className="mr-3 h-6 w-6" /> Single-Let Report
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-16 text-lg shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] bg-background"
          >
            <Link href="/dashboard/inspections/hmo">
              <PlusCircle className="mr-3 h-6 w-6" /> HMO Report
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-8">
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <div>
                <CardTitle className="text-xl">Inspection History</CardTitle>
                <CardDescription>
                  View and manage records from previous property checks.
                </CardDescription>
              </div>

              <div className="flex flex-col space-y-2 max-w-md">
                <Label
                  htmlFor="property-filter"
                  className="text-sm font-semibold flex items-center gap-2"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Select Active Property
                </Label>
                <Select
                  onValueChange={setSelectedPropertyId}
                  value={selectedPropertyId}
                >
                  <SelectTrigger
                    id="property-filter"
                    className="w-full bg-background border-primary/20 shadow-sm focus:ring-primary h-12"
                  >
                    <SelectValue
                      placeholder={
                        isLoadingProperties
                          ? 'Loading properties...'
                          : 'Choose from your active portfolio'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {[
                          prop.address.nameOrNumber,
                          prop.address.street,
                          prop.address.city,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingInspections ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !selectedPropertyId ? (
            <div className="text-center py-24 px-6 text-muted-foreground">
              <div className="bg-muted/50 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6">
                <Filter className="h-10 w-10 opacity-20" />
              </div>
              <p className="text-xl font-medium text-foreground mb-2">
                No Property Selected
              </p>
              <p className="text-sm max-w-sm mx-auto">
                Choose an active property from the dropdown above to view its specific inspection history and manage existing reports.
              </p>
            </div>
          ) : !activeInspections?.length ? (
            <div className="text-center py-24 px-6 text-muted-foreground">
              <div className="bg-muted/50 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-6">
                <CalendarCheck className="h-10 w-10 opacity-20" />
              </div>
              <p className="text-xl font-medium text-foreground mb-2">
                No records for this property
              </p>
              <p className="text-sm max-w-sm mx-auto">
                Start a new inspection using the buttons at the top of the page to populate this list.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">
                      Report Type
                    </TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">
                      Status
                    </TableHead>
                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">
                      Date
                    </TableHead>
                    <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeInspections.map((inspection) => (
                    <TableRow
                      key={inspection.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <TableCell className="font-semibold pl-6 py-4">
                        {inspection.type}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusVariant(inspection.status)}
                          className="capitalize"
                        >
                          {inspection.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {safeFormatDate(inspection.scheduledDate)}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            title="View Report"
                          >
                            <Link
                              href={`/dashboard/inspections/${inspection.id}?propertyId=${selectedPropertyId}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/inspections/${inspection.id}/edit?propertyId=${selectedPropertyId}`}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Report
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => setInspectionToDelete(inspection)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!inspectionToDelete}
        onOpenChange={(open) => !open && setInspectionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this inspection record for report type "
              {inspectionToDelete?.type}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
