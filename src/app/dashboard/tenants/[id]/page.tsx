'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Mail, Phone, Edit, Trash2, Home, Loader2, MoreVertical, UserPlus, Eye } from 'lucide-react';
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Types
interface Property {
    address: {
      street: string;
      city: string;
      postcode: string;
    };
}

interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    monthlyRent?: number;
    tenancyStartDate: any;
    tenancyEndDate?: any;
    notes?: string;
    status?: string;
}

interface TenantScreening { id: string; screeningDate: any; }

function safeCreateDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'object' && dateValue.seconds !== undefined) return new Date(dateValue.seconds * 1000);
    const d = new Date(dateValue);
    return isNaN(d.getTime()) ? null : d;
}

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'tenants', id);
  }, [firestore, id]);

  const { data: tenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);
  
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !tenant?.propertyId) return null;
    return doc(firestore, 'properties', tenant.propertyId);
  }, [firestore, tenant?.propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);
  
  const screeningsQuery = useMemoFirebase(() => {
    if (!firestore || !id || !user) return null;
    return query(collection(firestore, 'tenants', id, 'screenings'), where('ownerId', '==', user.uid));
  }, [firestore, id, user]);
  const { data: screenings } = useCollection<TenantScreening>(screeningsQuery);
  
  const firstScreening = screenings?.[0];

  const handleDeleteConfirm = async () => {
    if (!tenantRef) return;
    await updateDoc(tenantRef, { status: 'Archived' });
    toast({ title: 'Tenant Archived' });
    router.push('/dashboard/tenants');
  };

  if (isLoadingTenant) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!tenant) return notFound();

  const formatAddress = (address: Property['address'] | undefined) => {
    if (!address) return 'N/A';
    return [address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <>
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <div className='flex items-center gap-4'>
                    <Button variant="outline" size="icon" asChild><Link href="/dashboard/tenants"><ArrowLeft className="h-4 w-4" /></Link></Button>
                    <h1 className="text-2xl font-bold">{tenant.name}</h1>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link href={`/dashboard/tenants/${id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4"><User className="h-5 w-5 text-muted-foreground" /><span>{tenant.name}</span></div>
                        <div className="flex items-center gap-4"><Mail className="h-5 w-5 text-muted-foreground" /><a href={`mailto:${tenant.email}`} className="text-primary hover:underline">{tenant.email}</a></div>
                        <div className="flex items-center gap-4"><Phone className="h-5 w-5 text-muted-foreground" /><span>{tenant.telephone}</span></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Assigned Property</CardTitle></CardHeader>
                    <CardContent><div className="flex items-center gap-4"><Home className="h-5 w-5 text-muted-foreground" /><Link href={`/dashboard/properties/${tenant.propertyId}`} className="text-primary hover:underline">{formatAddress(property?.address)}</Link></div></CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader><CardTitle>Onboarding & Compliance</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold">Tenant Screening</h3>
                        {firstScreening ? (
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50 mt-2">
                                <div><p className="font-medium">Screening Completed</p><p className="text-sm text-muted-foreground">{format(safeCreateDate(firstScreening.screeningDate)!, 'PPP')}</p></div>
                                <Button asChild variant="outline"><Link href={`/dashboard/tenants/${id}/screenings/${firstScreening.id}`}><Eye className="mr-2 h-4 w-4" /> View</Link></Button>
                            </div>
                        ) : (
                            <div className="text-center border-2 border-dashed rounded-lg p-6 mt-2">
                                <Button asChild size="sm"><Link href={`/dashboard/tenants/screening?tenantId=${id}`}><UserPlus className="mr-2 h-4 w-4" /> Create Screening</Link></Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Archive Tenant?</AlertDialogTitle></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive">Archive</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
