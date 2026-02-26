'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Mail, Phone, Edit, Trash2, Home, Loader2, MoreVertical, UserPlus, Eye, FileCheck, MapPin, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, updateDoc, where, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
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
    ownerId: string;
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
  const searchParams = useSearchParams();
  const id = params.id as string;
  const urlPropertyId = searchParams.get('propertyId');
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Directly fetch using the propertyId if available in URL
  const directTenantRef = useMemoFirebase(() => {
    if (!firestore || !id || !urlPropertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', urlPropertyId, 'tenants', id);
  }, [firestore, id, urlPropertyId, user]);
  
  const { data: directTenant, isLoading: isLoadingDirect } = useDoc<Tenant>(directTenantRef);

  // Fallback: Search globally across all property sub-collections if propertyId is missing
  const tenantSearchQuery = useMemoFirebase(() => {
    if (!firestore || !id || !user || urlPropertyId) return null;
    return query(
      collectionGroup(firestore, 'tenants'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, id, user, urlPropertyId]);
  
  const { data: searchResults, isLoading: isLoadingSearch } = useCollection<Tenant>(tenantSearchQuery);

  const tenant = useMemo(() => {
      if (directTenant) return directTenant;
      return searchResults?.find(t => t.id === id) || null;
  }, [directTenant, searchResults, id]);

  const isLoadingTenant = isLoadingDirect || isLoadingSearch;

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !tenant?.propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId);
  }, [firestore, tenant?.propertyId, user]);
  const { data: property } = useDoc<Property>(propertyRef);
  
  const screeningsQuery = useMemoFirebase(() => {
    if (!firestore || !tenant || !user) return null;
    return collection(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId, 'tenants', tenant.id, 'screenings');
  }, [firestore, tenant, user]);
  const { data: screenings } = useCollection<TenantScreening>(screeningsQuery);
  
  const firstScreening = screenings?.[0];

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !tenant) return;
    const ref = doc(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId, 'tenants', tenant.id);
    updateDoc(ref, { status: 'Archived' })
      .then(() => {
        toast({ title: 'Tenant Archived' });
        router.push('/dashboard/tenants');
      });
  };

  if (isLoadingTenant) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Resolving secure path...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="bg-muted p-6 rounded-full">
          <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Tenant Record Not Found</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">This record may have been deleted, or you might be accessing a link without the required property context.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/tenants">Return to Tenants List</Link>
        </Button>
      </div>
    );
  }

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
                    <h1 className="text-2xl font-bold font-headline leading-tight break-words">{tenant.name}</h1>
                    <p className="text-sm text-muted-foreground">Tenant Profile</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" asChild className="hidden sm:inline-flex">
                    <Link href={`/dashboard/tenants/${id}/edit?propertyId=${tenant.propertyId}`}>
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
                            <Link href={`/dashboard/tenants/${id}/edit?propertyId=${tenant.propertyId}`}>
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
            <Card className="shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Contact Information</CardTitle>
                    <CardDescription>Primary communication details for this tenant.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-3 pt-6 border-t bg-muted/5">
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0 mt-1">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Full Name</p>
                            <p className="font-semibold text-foreground break-words">{tenant.name}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0 mt-1">
                            <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Email</p>
                            <a href={`mailto:${tenant.email}`} className="font-semibold text-primary hover:underline break-all block">
                                {tenant.email}
                            </a>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0 mt-1">
                            <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Telephone</p>
                            <p className="font-semibold text-foreground break-words">{tenant.telephone}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Assigned Property</CardTitle>
                    <CardDescription>The specific property currently rented by this tenant.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 border-t bg-muted/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="p-2.5 rounded-lg bg-muted shrink-0 mt-1">
                                <MapPin className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <Link href={`/dashboard/properties/${tenant.propertyId}`} className="text-lg font-bold text-primary hover:underline leading-tight block whitespace-normal">
                                    {propertyAddress}
                                </Link>
                                <div className="flex items-center flex-wrap gap-2 mt-2">
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
                        <Button variant="outline" asChild className="shrink-0 w-full md:w-auto">
                            <Link href={`/dashboard/properties/${tenant.propertyId}`}>
                                <Home className="mr-2 h-4 w-4" />
                                Full Property Profile
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">Onboarding & Compliance</CardTitle>
                <CardDescription>Track screening reports and legal checks for this tenancy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 border-t">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                        <FileCheck className="h-4 w-4" />
                        Tenant Screening
                    </h3>
                    {firstScreening ? (
                        <div className="flex flex-col sm:row sm:items-center justify-between p-5 border rounded-xl bg-muted/20 gap-4">
                            <div>
                                <p className="font-bold text-foreground">Comprehensive Screening Completed</p>
                                <p className="text-xs text-muted-foreground mt-1 font-medium">Finalized on: {safeCreateDate(firstScreening.screeningDate) ? format(safeCreateDate(firstScreening.screeningDate)!, 'PPP') : 'N/A'}</p>
                            </div>
                            <Button asChild variant="outline" className="w-full sm:w-auto">
                                <Link href={`/dashboard/tenants/${id}/screenings/${firstScreening.id}?propertyId=${tenant.propertyId}`}>
                                    <Eye className="mr-2 h-4 w-4" /> View Report
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center border-2 border-dashed rounded-xl p-10 bg-muted/5">
                            <p className="text-sm text-muted-foreground mb-6 font-medium">No screening report found for this tenant.</p>
                            <Button asChild className="shadow-md">
                                <Link href={`/dashboard/tenants/screening?tenantId=${id}&propertyId=${tenant.propertyId}`}>
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
