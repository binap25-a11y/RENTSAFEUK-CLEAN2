'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, User, Mail, Phone, Calendar as CalendarIcon, ShieldCheck, Edit, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Main interface for a Property document from Firestore
interface Property {
    address: string;
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


export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);

  const { data: property, isLoading: isLoadingProperty, error } = useDoc<Property>(propertyRef);

  const tenantsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(
        collection(firestore, 'tenants'),
        where('propertyId', '==', propertyId),
        where('status', '==', 'Active')
    );
  }, [firestore, propertyId]);

  const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

  const isLoading = isLoadingProperty || isLoadingTenants;

  const handleDelete = async (propertyId: string, address: string) => {
    if (!firestore) return;
    const isConfirmed = confirm(
      `Are you sure you want to delete the property at ${address}?`
    );
    if (isConfirmed) {
      try {
        const docRef = doc(firestore, 'properties', propertyId);
        await updateDoc(docRef, { status: 'Deleted' });
        toast({
          title: 'Property Deleted',
          description: `${address} has been moved to the deleted properties list.`,
        });
        router.push('/dashboard/properties');
      } catch (e) {
        console.error('Error deleting property:', e);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not delete the property. Please try again.',
        });
      }
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
    <div className="flex flex-col gap-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/properties">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{property.address}</h1>
      </div>
      <div className="space-y-6">
        <Card>
            <CardContent className="p-0">
                <Image
                    src={property.imageUrl}
                    alt={`Image of ${property.address}`}
                    width={800}
                    height={500}
                    className="rounded-t-lg object-cover w-full aspect-video"
                />
            </CardContent>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className='mb-2'>{property.address}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{property.propertyType}</span>
                            <span className='flex items-center gap-1'><Bed className="h-4 w-4" /> {property.bedrooms}</span>
                            <span className='flex items-center gap-1'><Bath className="h-4 w-4" /> {property.bathrooms}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge>{property.status}</Badge>
                         <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/properties/${propertyId}/edit`}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(propertyId, property.address)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                    </div>
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
                    <div className="rounded-md border">
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
      </div>
    </div>
  );
}
