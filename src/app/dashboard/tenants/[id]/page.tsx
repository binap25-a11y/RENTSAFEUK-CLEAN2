'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Mail, Phone, Edit, Trash2, Home, Loader2, MoreVertical, UserPlus, Eye, FileCheck, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, updateDoc, where } from 'firebase/firestore';
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

// Types
interface Property {
    id: string;
    address: {
      nameOrNumber?: string;
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
  const { data: property } = useDoc<Property>(propertyRef);
  
  const screeningsQuery = useMemoFirebase(() => {
    if (!firestore || !id || !user) return null;
    return query(collection(firestore, 'tenants', id, 'screenings'), where('ownerId', '==', user.uid));
  }, [firestore, id, user]);
  const { data: screenings } = useCollection<TenantScreening>(screeningsQuery);
  
  const firstScreening = screenings?.[0];

  const handleDeleteConfirm = async () => {
    if (!tenantRef) return;
    updateDoc(tenantRef, { status: 'Archived' })
      .then(() => {
        toast({ title: 'Tenant Archived' });
        router.push('/dashboard/tenants');
      });
  };

  if (isLoadingTenant) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!tenant) return notFound();

  const formatAddress = (address: Property['address'] | undefined) => {
    if (!address) return 'N/A';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  const propertyAddress = formatAddress(property?.address);

  return (
    <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/tenants"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold font-headline">{tenant.name}</h1>
                    <p className="text-sm text-muted-foreground">Tenant Profile</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" asChild className="hidden sm:inline-flex">
                    <Link href={`/dashboard/tenants/${id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Profile
                    </Link>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild className="sm:hidden">
                            <Link href={`/dashboard/tenants/${id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Profile
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Archive Tenant
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                    <CardDescription>Primary communication details for this tenant.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-3 pt-4 border-t">
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Full Name</p>
                            <p className="font-semibold">{tenant.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Email</p>
                            <a href={`mailto:${tenant.email}`} className="font-semibold text-primary hover:underline break-all block">{tenant.email}</a>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                            <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Telephone</p>
                            <p className="font-semibold">{tenant.telephone}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Assigned Property</CardTitle>
                    <CardDescription>The specific property currently rented by this tenant.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 border-t">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4 flex-1">
                            <div className="p-2 rounded-lg bg-muted shrink-0 mt-1">
                                <MapPin className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                                <Link href={`/dashboard/properties/${tenant.propertyId}`} className="text-lg font-bold text-primary hover:underline leading-tight block">
                                    {propertyAddress}
                                </Link>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                                        Status: {tenant.status || 'Active'}
                                    </Badge>
                                    {tenant.monthlyRent && (
                                        <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                                            Rent: £{tenant.monthlyRent.toLocaleString()}/mo
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                        <Button variant="outline" asChild className="shrink-0">
                            <Link href={`/dashboard/properties/${tenant.propertyId}`}>
                                <Home className="mr-2 h-4 w-4" />
                                Full Property Profile
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Onboarding & Compliance</CardTitle>
                <CardDescription>Track screening reports and legal checks for this tenancy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-4 border-t">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                        <FileCheck className="h-4 w-4" />
                        Tenant Screening
                    </h3>
                    {firstScreening ? (
                        <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
                            <div>
                                <p className="font-bold">Comprehensive Screening Completed</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Finalized on: {format(safeCreateDate(firstScreening.screeningDate)!, 'PPP')}</p>
                            </div>
                            <Button asChild variant="outline">
                                <Link href={`/dashboard/tenants/${id}/screenings/${firstScreening.id}`}>
                                    <Eye className="mr-2 h-4 w-4" /> View Report
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center border-2 border-dashed rounded-xl p-8 bg-muted/5">
                            <p className="text-sm text-muted-foreground mb-4">No screening report found for this tenant.</p>
                            <Button asChild>
                                <Link href={`/dashboard/tenants/screening?tenantId=${id}`}>
                                    <UserPlus className="mr-2 h-4 w-4" /> Create Screening Report
                                </Link>
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Archive this tenant?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will move {tenant.name} to your archived tenants list. You can restore them later from the archives page.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Archive Tenant
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
