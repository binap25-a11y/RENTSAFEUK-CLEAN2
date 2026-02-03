'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Mail, Phone, Calendar as CalendarIcon, Edit, Archive, Home, Loader2, MoreVertical, UserPlus, Eye, ListTodo } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, updateDoc, where, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


// Type for a Property document from Firestore
interface Property {
    address: {
      nameOrNumber?: string;
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
}

// Type for tenant from firestore
interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    tenancyStartDate: { seconds: number, nanoseconds: number } | Date | string;
    tenancyEndDate?: { seconds: number, nanoseconds: number } | Date | string;
    notes?: string;
    status?: string;
}

// Type for screening record
interface TenantScreening {
    id: string;
    screeningDate: { seconds: number; nanoseconds: number } | Date | string;
}

// Type for checklist record
interface Checklist {
    id: string;
    completedDate: { seconds: number; nanoseconds: number } | Date | string;
}

// A robust function to handle various date formats
function safeCreateDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    // If it's already a Date object, return it
    if (dateValue instanceof Date) return dateValue;
    // Handle Firestore Timestamp object
    if (typeof dateValue === 'object' && dateValue.seconds !== undefined) {
        return new Date(dateValue.seconds * 1000);
    }
    // Handle ISO string or other date-parsable strings/numbers
    const d = new Date(dateValue);
    // Check if the parsed date is valid
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
}


export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'tenants', id);
  }, [firestore, id]);

  const { data: tenant, isLoading: isLoadingTenant, error } = useDoc<Tenant>(tenantRef);
  
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !tenant?.propertyId) return null;
    return doc(firestore, 'properties', tenant.propertyId);
  }, [firestore, tenant?.propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);
  
  const screeningsQuery = useMemoFirebase(() => {
    if (!firestore || !id || !user) return null;
    return query(
        collection(firestore, 'tenants', id, 'screenings'),
        where('ownerId', '==', user.uid)
    );
  }, [firestore, id, user]);
  const { data: screenings, isLoading: isLoadingScreenings } = useCollection<TenantScreening>(screeningsQuery);
  
  const checklistsQuery = useMemoFirebase(() => {
    if (!firestore || !tenant?.propertyId || !id || !user) return null;
    return query(
        collection(firestore, 'properties', tenant.propertyId, 'checklists'),
        where('ownerId', '==', user.uid),
        where('tenantId', '==', id),
        limit(1)
    );
  }, [firestore, user, tenant?.propertyId, id]);
  const { data: checklists, isLoading: isLoadingChecklists } = useCollection<Checklist>(checklistsQuery);

  const checklist = checklists?.[0];

  const handleArchiveConfirm = async () => {
    if (!firestore || !tenant || !tenantRef) return;
    try {
      await updateDoc(tenantRef, { status: 'Archived' });
      toast({
        title: 'Tenant Archived',
        description: `${tenant.name} has been moved to the archives.`,
      });
      router.push('/dashboard/tenants');
    } catch (e) {
      console.error('Error archiving tenant:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not archive the tenant. Please try again.',
      });
    } finally {
        setIsArchiveDialogOpen(false);
    }
  };

  const isLoading = isLoadingTenant || isLoadingProperty || isLoadingScreenings || isLoadingChecklists;
  
  const formatAddress = (address: Property['address'] | undefined) => {
    if (!address) return 'N/A';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className='text-destructive'>Error: {error.message}</p>
  }
  
  if (!tenant) {
    return notFound();
  }

  const startDate = safeCreateDate(tenant.tenancyStartDate);
  const endDate = safeCreateDate(tenant.tenancyEndDate);
  const completedDate = checklist ? safeCreateDate(checklist.completedDate) : null;

  return (
    <>
        <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
                <div className='flex items-center gap-4'>
                    <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/tenants">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">{tenant.name}</h1>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href={`/dashboard/tenants/${id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </DropdownMenuItem>
                        {tenant.status !== 'Archived' && (
                            <DropdownMenuItem onClick={() => setIsArchiveDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Archive className="mr-2 h-4 w-4" /> Archive
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <User className="h-5 w-5 text-muted-foreground" />
                        <span>{tenant.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                            {tenant.email}
                        </a>
                    </div>
                    <div className="flex items-center gap-4">
                        <Phone className="h-5 w-5 text-muted-foreground" />
                        <span>{tenant.telephone}</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Assigned Property</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center gap-4">
                        <Home className="h-5 w-5 text-muted-foreground" />
                        {isLoadingProperty ? (
                            <span>Loading property...</span>
                        ) : property ? (
                            <Link href={`/dashboard/properties/${tenant.propertyId}`} className="text-primary hover:underline">
                                {formatAddress(property.address)}
                            </Link>
                        ) : (
                            <span>Property not found</span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Tenancy Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-4">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="text-sm text-muted-foreground">Tenancy Start</p>
                            <p>{startDate ? format(startDate, 'PPP') : 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="text-sm text-muted-foreground">Tenancy End</p>
                            <p>{endDate ? format(endDate, 'PPP') : 'N/A'}</p>
                        </div>
                    </div>
                </div>
                {tenant.notes && (
                    <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tenant.notes}</p>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Onboarding &amp; Compliance</CardTitle>
                <CardDescription>Manage screening records and pre-tenancy tasks for {tenant.name}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold">Tenant Screening</h3>
                    <div className="flex items-center gap-2 mt-2 mb-4">
                        <Button asChild size="sm">
                            <Link href={`/dashboard/tenants/screening?tenantId=${id}`}>
                                <UserPlus className="mr-2 h-4 w-4" /> Start New Screening
                            </Link>
                        </Button>
                    </div>
                     {isLoadingScreenings ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : screenings && screenings.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Screening Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {screenings.map(screening => {
                                        const screeningDate = safeCreateDate(screening.screeningDate);
                                        return (
                                            <TableRow key={screening.id}>
                                                <TableCell>{screeningDate ? format(screeningDate, 'PPP') : 'N/A'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/dashboard/tenants/${id}/screenings/${screening.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" /> View
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-4">No screening records found.</p>
                    )}
                </div>

                <div className="border-t pt-6">
                     <h3 className="text-lg font-semibold">Pre-Tenancy Checklist</h3>
                     <p className="text-sm text-muted-foreground mb-4">A single checklist can be created for this tenant's current tenancy.</p>
                     {isLoadingChecklists ? (
                        <div className="flex items-center gap-2">
                           <Loader2 className="h-5 w-5 animate-spin" />
                           <span>Loading checklist status...</span>
                        </div>
                     ) : checklist ? (
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 border rounded-lg bg-muted/50">
                           <div>
                             <p className="font-medium">Checklist Completed</p>
                             <p className="text-sm text-muted-foreground">
                               {completedDate ? format(completedDate, 'PPP') : 'N/A'}
                             </p>
                           </div>
                           <div className="flex gap-2">
                               <Button asChild>
                                    <Link href={`/dashboard/checklists/${checklist.id}?propertyId=${tenant.propertyId}&tenantId=${id}`}>
                                        <Eye className="mr-2 h-4 w-4" /> View Checklist
                                    </Link>
                               </Button>
                           </div>
                        </div>
                     ) : (
                        <>
                            <Button asChild disabled={!tenant.propertyId}>
                                <Link href={tenant.propertyId ? `/dashboard/checklists?propertyId=${tenant.propertyId}&tenantId=${id}` : '#'}>
                                    <ListTodo className="mr-2 h-4 w-4" /> Create Pre-Tenancy Checklist
                                </Link>
                            </Button>
                            {!tenant.propertyId && (
                                <p className="text-xs text-muted-foreground mt-2">A property must be assigned to the tenant to create a checklist.</p>
                            )}
                        </>
                     )}
                </div>
            </CardContent>
        </Card>
    </div>
        <AlertDialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                This will archive {tenant.name}. You can restore them later.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleArchiveConfirm}
                >
                Archive
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
