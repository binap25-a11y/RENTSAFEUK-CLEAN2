'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, User, Mail, Phone, Calendar as CalendarIcon, ShieldCheck, Edit, Trash2, UserPlus, Loader2, MoreVertical, Wrench, CalendarCheck, Files, PlusCircle, Upload, Eye } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, where, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

// Main interface for a Property document from Firestore
interface Property {
    address: {
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
    propertyType: string;
    status: string;
    bedrooms: number;
    bathrooms: number;
    imageUrl: string;
    tenancy?: {
        monthlyRent?: number;
        depositAmount?: number;
        depositScheme?: string;
    }
}

// Type for tenant from firestore
interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    tenancyStartDate: { seconds: number, nanoseconds: number } | Date;
    tenancyEndDate?: { seconds: number, nanoseconds: number } | Date;
    notes?: string;
}

interface MaintenanceLog {
    id: string;
    title: string;
    priority: string;
    status: string;
}

interface Inspection {
    id: string;
    type: string;
    status: string;
    scheduledDate: { seconds: number; nanoseconds: number } | Date;
}

interface DocumentSummary {
    id: string;
    title: string;
    documentType: string;
    fileUri: string;
}


export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { user } = useUser();

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);

  const { data: property, isLoading: isLoadingProperty, error } = useDoc<Property>(propertyRef);

  const tenantsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
        collection(firestore, 'tenants'),
        where('propertyId', '==', propertyId),
        where('ownerId', '==', user.uid),
        where('status', '==', 'Active')
    );
  }, [firestore, propertyId, user]);
  const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

  const maintenanceLogsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(
        collection(firestore, 'properties', propertyId, 'maintenanceLogs'),
        where('status', 'in', ['Open', 'In Progress'])
    );
  }, [firestore, propertyId]);
  const { data: maintenanceLogs, isLoading: isLoadingMaintenance } = useCollection<MaintenanceLog>(maintenanceLogsQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(
        collection(firestore, 'properties', propertyId, 'inspections'),
        where('status', '==', 'Scheduled')
    );
  }, [firestore, propertyId]);
  const { data: inspections, isLoading: isLoadingInspections } = useCollection<Inspection>(inspectionsQuery);

  const documentsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(
        collection(firestore, 'properties', propertyId, 'documents')
    );
  }, [firestore, propertyId]);
  const { data: documents, isLoading: isLoadingDocuments } = useCollection<DocumentSummary>(documentsQuery);

  const isLoading = isLoadingProperty || isLoadingTenants || isLoadingMaintenance || isLoadingInspections || isLoadingDocuments;

  const handleDeleteConfirm = async () => {
    if (!firestore || !property) return;
    
    try {
      const docRef = doc(firestore, 'properties', propertyId);
      await updateDoc(docRef, { status: 'Deleted' });
      toast({
        title: 'Property Deleted',
        description: `${property.address.street} has been moved to the deleted properties list.`,
      });
      router.push('/dashboard/properties');
    } catch (e) {
      console.error('Error deleting property:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the property. Please try again.',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
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
  
  if (!property) {
    return notFound();
  }

  const tenancy = property.tenancy;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/properties">
                    <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{property.address.street}</h1>
                    <p className="text-muted-foreground">{`${property.address.city}, ${property.address.county ? property.address.county + ', ' : ''}${property.address.postcode}`}</p>
                    
                </div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/properties/${propertyId}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <div className="space-y-6">
          <Card>
              <CardContent className="p-0">
                  <Image
                      src={property.imageUrl}
                      alt={`Image of ${property.address.street}`}
                      width={800}
                      height={500}
                      className="rounded-t-lg object-cover w-full aspect-video"
                  />
              </CardContent>
              <CardHeader>
                   <div className="flex items-center gap-4">
                        <Badge>{property.status}</Badge>
                    </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                        <span>{property.propertyType}</span>
                        <span className='flex items-center gap-1'><Bed className="h-4 w-4" /> {property.bedrooms}</span>
                        <span className='flex items-center gap-1'><Bath className="h-4 w-4" /> {property.bathrooms}</span>
                  </div>
              </CardHeader>
          </Card>
          
          <Card>
              <CardHeader>
                  <div className="flex justify-between items-center">
                      <CardTitle>Tenants</CardTitle>
                      <Button asChild size="sm">
                          <Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}>
                              <UserPlus className="mr-2 h-4 w-4" /> Assign New Tenant
                          </Link>
                      </Button>
                  </div>
              </CardHeader>
              <CardContent>
                  {isLoadingTenants ? (
                      <div className="flex justify-center items-center h-24">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                  ) : tenants && tenants.length > 0 ? (
                      <>
                          {/* Desktop Table View */}
                          <div className="hidden rounded-md border md:block">
                              <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>Name</TableHead>
                                          <TableHead>Email</TableHead>
                                          <TableHead>Start Date</TableHead>
                                          <TableHead className="text-right">Actions</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {tenants.map(tenant => {
                                          const startDate = tenant.tenancyStartDate ? (tenant.tenancyStartDate instanceof Date ? tenant.tenancyStartDate : new Date(tenant.tenancyStartDate.seconds * 1000)) : null;
                                          return (
                                              <TableRow key={tenant.id}>
                                                  <TableCell className="font-medium">
                                                      <Link href={`/dashboard/tenants/${tenant.id}`} className="hover:underline">{tenant.name}</Link>
                                                  </TableCell>
                                                  <TableCell>{tenant.email}</TableCell>
                                                  <TableCell>{startDate ? format(startDate, 'PPP') : 'N/A'}</TableCell>
                                                  <TableCell className="text-right">
                                                      <Button asChild variant="ghost" size="icon">
                                                          <Link href={`/dashboard/tenants/${tenant.id}/edit`}>
                                                              <Edit className="h-4 w-4" /><span className="sr-only">Edit</span>
                                                          </Link>
                                                      </Button>
                                                  </TableCell>
                                              </TableRow>
                                          );
                                      })}
                                  </TableBody>
                              </Table>
                          </div>
                           {/* Mobile Card View */}
                          <div className="grid gap-4 md:hidden">
                              {tenants.map(tenant => {
                                  const startDate = tenant.tenancyStartDate ? (tenant.tenancyStartDate instanceof Date ? tenant.tenancyStartDate : new Date(tenant.tenancyStartDate.seconds * 1000)) : null;
                                  return (
                                      <Card key={tenant.id}>
                                          <CardHeader>
                                              <div className="flex justify-between items-start">
                                                  <CardTitle className="text-base">
                                                      <Link href={`/dashboard/tenants/${tenant.id}`} className="hover:underline">
                                                          {tenant.name}
                                                      </Link>
                                                  </CardTitle>
                                                  <Button asChild variant="outline" size="sm">
                                                      <Link href={`/dashboard/tenants/${tenant.id}/edit`}>
                                                          <Edit className="mr-2 h-4 w-4" /> Edit
                                                      </Link>
                                                  </Button>
                                              </div>
                                          </CardHeader>
                                          <CardContent className="space-y-2 text-sm pt-0">
                                              <div className="flex items-center gap-2">
                                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                                  <a href={`mailto:${tenant.email}`} className='truncate hover:underline'>{tenant.email}</a>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                  <span>Start Date: {startDate ? format(startDate, 'PPP') : 'N/A'}</span>
                                              </div>
                                          </CardContent>
                                      </Card>
                                  );
                              })}
                          </div>
                      </>
                  ) : (
                      <div className="text-center py-8 text-muted-foreground">
                          <p>No active tenants assigned to this property.</p>
                      </div>
                  )}
              </CardContent>
          </Card>

          <Card>
              <CardHeader>
                  <CardTitle>Financials</CardTitle>
              </CardHeader>
              <CardContent>
                  {tenancy && (tenancy.monthlyRent || tenancy.depositAmount || tenancy.depositScheme) ? (
                      <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {tenancy.monthlyRent && (
                                  <div>
                                      <p className="text-sm text-muted-foreground">Monthly Rent</p>
                                      <p className='font-semibold'>£{tenancy.monthlyRent.toFixed(2)}</p>
                                  </div>
                              )}
                              {tenancy.depositAmount && (
                                  <div>
                                      <p className="text-sm text-muted-foreground">Deposit Amount</p>
                                      <p className='font-semibold'>£{tenancy.depositAmount.toFixed(2)}</p>
                                  </div>
                              )}
                          </div>
                          {tenancy.depositScheme && (
                              <div className="flex items-start gap-4 pt-4">
                                  <ShieldCheck className="h-5 w-5 text-muted-foreground mt-1" />
                                  <div>
                                      <p className="text-sm text-muted-foreground">Deposit Scheme</p>
                                      <p className='font-semibold'>{tenancy.depositScheme}</p>
                                  </div>
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="text-center text-muted-foreground">
                          <p>No financial information has been added for this property. You can add it by editing the property.</p>
                      </div>
                  )}
              </CardContent>
          </Card>
           <div className="grid gap-6 md:grid-cols-2">
              <Card>
                  <CardHeader>
                      <div className="flex justify-between items-center">
                          <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Open Maintenance</CardTitle>
                          <Button asChild size="sm">
                              <Link href="/dashboard/maintenance">
                                  <PlusCircle className="mr-2 h-4 w-4" /> New Log
                              </Link>
                          </Button>
                      </div>
                  </CardHeader>
                  <CardContent>
                      {isLoadingMaintenance ? (
                          <div className="flex justify-center items-center h-24">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                      ) : maintenanceLogs && maintenanceLogs.length > 0 ? (
                          <div className="space-y-2">
                              {maintenanceLogs.map(log => (
                                  <Link key={log.id} href={`/dashboard/maintenance/${log.id}?propertyId=${propertyId}`} className="block p-3 rounded-md hover:bg-accent">
                                      <div className="flex justify-between items-start">
                                          <p className="font-medium text-sm">{log.title}</p>
                                          <Badge variant={log.priority === 'Emergency' || log.priority === 'Urgent' ? 'destructive' : 'outline'}>{log.priority}</Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{log.status}</p>
                                  </Link>
                              ))}
                          </div>
                      ) : (
                          <div className="text-center py-8 text-muted-foreground">
                              <p>No open maintenance issues.</p>
                          </div>
                      )}
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <div className="flex justify-between items-center">
                          <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5" /> Upcoming Inspections</CardTitle>
                          <Button asChild size="sm">
                              <Link href="/dashboard/inspections">
                                  <PlusCircle className="mr-2 h-4 w-4" /> New Inspection
                              </Link>
                          </Button>
                      </div>
                  </CardHeader>
                  <CardContent>
                      {isLoadingInspections ? (
                          <div className="flex justify-center items-center h-24">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                      ) : inspections && inspections.length > 0 ? (
                          <div className="space-y-2">
                              {inspections.filter(insp => isFuture(insp.scheduledDate instanceof Date ? insp.scheduledDate : new Date(insp.scheduledDate.seconds * 1000))).map(insp => (
                                  <Link key={insp.id} href={`/dashboard/inspections/${insp.id}?propertyId=${propertyId}`} className="block p-3 rounded-md hover:bg-accent">
                                      <div className="flex justify-between items-start">
                                          <p className="font-medium text-sm">{insp.type}</p>
                                          <p className="text-sm text-muted-foreground">{format(insp.scheduledDate instanceof Date ? insp.scheduledDate : new Date(insp.scheduledDate.seconds * 1000), 'PPP')}</p>
                                      </div>
                                  </Link>
                              ))}
                          </div>
                      ) : (
                          <div className="text-center py-8 text-muted-foreground">
                              <p>No upcoming inspections scheduled.</p>
                          </div>
                      )}
                  </CardContent>
              </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2"><Files className="h-5 w-5" /> Documents</CardTitle>
                        <Button asChild size="sm">
                            <Link href="/dashboard/documents/upload">
                                <Upload className="mr-2 h-4 w-4" /> Upload
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoadingDocuments ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : documents && documents.length > 0 ? (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {documents.slice(0, 5).map(doc => (
                                        <TableRow key={doc.id}>
                                            <TableCell className="font-medium">{doc.title}</TableCell>
                                            <TableCell>{doc.documentType}</TableCell>
                                            <TableCell className="text-right">
                                                <Button asChild variant="outline" size="icon">
                                                    <a href={doc.fileUri} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No documents uploaded for this property.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the property at {property?.address.street}. You can restore it later from the 'View Deleted' page.
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
    </>
  );
}
