
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Edit, 
  Trash2, 
  Home, 
  Loader2, 
  MoreVertical, 
  UserPlus, 
  Eye, 
  FileCheck, 
  MapPin, 
  AlertCircle,
  BellRing,
  CalendarDays,
  Banknote
} from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, updateDoc, where, collectionGroup, getDocs, limit } from 'firebase/firestore';
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
    rentDueDay?: number;
    tenancyStartDate: any;
    tenancyEndDate?: any;
    notes?: string;
    status?: string;
    userId: string;
    lastReminderSent?: any;
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
  const [isArchiving, setIsArchiving] = useState(false);

  const directTenantRef = useMemoFirebase(() => {
    if (!firestore || !id || !urlPropertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', urlPropertyId, 'tenants', id);
  }, [firestore, id, urlPropertyId, user]);
  
  const { data: directTenant, isLoading: isLoadingDirect } = useDoc<Tenant>(directTenantRef);

  const tenantSearchQuery = useMemoFirebase(() => {
    if (!firestore || !id || !user || urlPropertyId) return null;
    return query(
      collectionGroup(firestore, 'tenants'),
      where('userId', '==', user.uid)
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

  const handleSendReminder = async () => {
    if (!tenant || !property || !user || !firestore) return;
    
    const propertyAddr = [property.address.street, property.address.city].filter(Boolean).join(', ');
    const subject = encodeURIComponent(`Rent Reminder: ${propertyAddr}`);
    const body = encodeURIComponent(`Hi ${tenant.name},\n\nThis is a friendly reminder that rent for ${propertyAddr} is due on the ${tenant.rentDueDay || '1st'} of the month.\n\nMonthly Rent: £${tenant.monthlyRent?.toLocaleString() || '0'}\n\nPlease let us know if you have any questions.\n\nBest regards,\nYour Landlord`);
    
    window.location.href = `mailto:${tenant.email}?subject=${subject}&body=${body}`;
    
    const tRef = doc(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId, 'tenants', tenant.id);
    updateDoc(tRef, { lastReminderSent: new Date().toISOString() });
    
    toast({ title: 'Reminder Composed', description: 'Update logged and email client opened.' });
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !tenant || !propertyRef) return;
    setIsArchiving(true);

    try {
        const ref = doc(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId, 'tenants', tenant.id);
        
        // 1. Mark tenant as archived
        await updateDoc(ref, { status: 'Archived' });

        // 2. Check if any other active tenants exist for this property
        const activeTenantsQuery = query(
            collection(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId, 'tenants'),
            where('status', '==', 'Active'),
            limit(2)
        );
        const activeTenantsSnap = await getDocs(activeTenantsQuery);
        
        // 3. If no other active tenants, set property to Vacant
        if (activeTenantsSnap.empty) {
            await updateDoc(propertyRef, { status: 'Vacant' });
        }

        toast({ title: 'Tenant Archived', description: 'Unit status has been updated.' });
        router.push('/dashboard/tenants');
    } catch (e) {
        console.error("Archive failed:", e);
        toast({ variant: 'destructive', title: 'Action Failed' });
    } finally {
        setIsArchiving(false);
        setIsDeleteDialogOpen(false);
    }
  };

  if (isLoadingTenant) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Resolving secure path...</p>
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
        <div className="flex flex-col gap-4">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild className="shrink-0">
                    <Link href="/dashboard/tenants"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold font-headline leading-tight break-words">{tenant.name}</h1>
                    <p className="text-sm text-muted-foreground font-medium">Tenant Profile</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={handleSendReminder} className="gap-2 font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-sm border-primary/20 hover:bg-primary/5">
                    <BellRing className="h-3.5 w-3.5 text-primary" /> Send Rent Nudge
                </Button>
                <Button variant="outline" asChild className="h-10 px-6 font-bold uppercase tracking-widest text-[10px] shadow-sm border-primary/20 hover:bg-primary/5">
                    <Link href={`/dashboard/tenants/${id}/edit?propertyId=${tenant.propertyId}`}>
                        <Edit className="mr-2 h-3.5 w-3.5 text-primary" /> Edit Profile
                    </Link>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 border border-muted">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive font-bold">
                            <Trash2 className="mr-2 h-4 w-4" /> Archive Tenant
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <div className="flex flex-col gap-6">
            <Card className="shadow-lg border-none">
                <CardHeader className="pb-4 bg-muted/20 border-b">
                    <CardTitle className="text-lg font-headline">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-sm transition-all hover:border-primary/20">
                            <div className="p-2.5 rounded-full bg-primary/10 text-primary shrink-0"><Mail className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Email Address</p>
                                <a href={`mailto:${tenant.email}`} className="font-bold text-primary hover:underline break-all block text-sm">{tenant.email}</a>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-sm transition-all hover:border-primary/20">
                            <div className="p-2.5 rounded-full bg-primary/10 text-primary shrink-0"><Phone className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Mobile Phone</p>
                                <p className="font-bold text-sm">{tenant.telephone}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
                <CardHeader className="pb-4 bg-muted/20 border-b">
                    <CardTitle className="text-lg font-headline">Tenancy Agreement Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-background border shadow-sm flex items-start gap-4">
                            <div className="p-2.5 rounded-lg bg-green-50 text-green-600 shrink-0"><Banknote className="h-5 w-5" /></div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Agreed Rent</p>
                                <p className="font-bold text-xl">£{tenant.monthlyRent?.toLocaleString() || '0'}<span className="text-xs font-medium text-muted-foreground"> /mo</span></p>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-background border shadow-sm flex items-start gap-4">
                            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0"><CalendarDays className="h-5 w-5" /></div>
                            <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Payment Due Date</p>
                                <p className="font-bold text-xl">{tenant.rentDueDay || '1'}<span className="text-xs font-medium text-muted-foreground">{[1, 21, 31].includes(tenant.rentDueDay || 1) ? 'st' : [2, 22].includes(tenant.rentDueDay || 1) ? 'nd' : [3, 23].includes(tenant.rentDueDay || 1) ? 'rd' : 'th'} of month</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 rounded-xl bg-muted/30 border border-dashed flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Contract Term
                        </div>
                        <div className="flex items-center gap-8">
                            <div className="flex-1">
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Effective Start</p>
                                <p className="font-bold text-base">{safeCreateDate(tenant.tenancyStartDate) ? format(safeCreateDate(tenant.tenancyStartDate)!, 'dd MMM yyyy') : 'N/A'}</p>
                            </div>
                            <div className="h-10 w-px bg-border shrink-0" />
                            <div className="flex-1 text-right">
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Agreement End</p>
                                <p className="font-bold text-base text-primary">{safeCreateDate(tenant.tenancyEndDate) ? format(safeCreateDate(tenant.tenancyEndDate)!, 'dd MMM yyyy') : 'Rolling Periodic'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="shadow-lg border-none">
                <CardHeader className="pb-4 bg-muted/20 border-b">
                    <CardTitle className="text-lg font-headline">Assigned Asset</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-4 rounded-xl bg-background border shadow-sm">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="p-2.5 rounded-lg bg-muted/50 text-primary shrink-0 mt-1">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <Link href={`/dashboard/properties/${tenant.propertyId}`} className="text-lg font-bold text-primary hover:underline leading-tight block whitespace-normal">
                                    {propertyAddress}
                                </Link>
                                <div className="flex items-center flex-wrap gap-2 mt-2">
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest border-primary/20 bg-primary/5 text-primary">
                                        {tenant.status || 'Active'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <Button variant="outline" asChild className="shrink-0 w-full md:w-auto h-11 px-8 font-bold shadow-sm uppercase tracking-widest text-[10px]">
                            <Link href={`/dashboard/properties/${tenant.propertyId}`}>
                                <Home className="mr-2 h-4 w-4" />
                                Property Hub
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-none">
                <CardHeader className="pb-4 bg-muted/20 border-b">
                    <CardTitle className="text-lg font-headline">Compliance Registry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div>
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-primary" />
                            Pre-Tenancy Vetting
                        </h3>
                        {firstScreening ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border rounded-2xl bg-muted/10 gap-4 group transition-all hover:bg-muted/20">
                                <div>
                                    <p className="font-bold text-sm">Comprehensive Screening Verified</p>
                                    <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-widest">Finalized on: {safeCreateDate(firstScreening.screeningDate) ? format(safeCreateDate(firstScreening.screeningDate)!, 'PPP') : 'N/A'}</p>
                                </div>
                                <Button asChild variant="outline" className="w-full sm:w-auto font-bold h-10 px-8 uppercase text-[10px] tracking-widest shadow-sm">
                                    <Link href={`/dashboard/tenants/${id}/screenings/${firstScreening.id}?propertyId=${tenant.propertyId}`}>
                                        <Eye className="mr-2 h-4 w-4 text-primary" /> Full Report
                                    </Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center border-2 border-dashed rounded-2xl p-12 bg-muted/5">
                                <p className="text-xs text-muted-foreground mb-6 font-medium italic">No formal screening record found.</p>
                                <Button asChild className="shadow-lg h-11 px-10 font-bold uppercase text-[10px] tracking-widest">
                                    <Link href={`/dashboard/tenants/screening?tenantId=${id}&propertyId=${tenant.propertyId}`}>
                                        <UserPlus className="mr-2 h-4 w-4" /> Start Screening
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                <AlertDialogHeader>
                    <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4">
                        <Trash2 className="h-8 w-8 text-destructive" />
                    </div>
                    <AlertDialogTitle className="text-xl font-headline text-center">Archive tenant record?</AlertDialogTitle>
                    <AlertDialogDescription className="text-base font-medium text-center">
                        This will move <strong className="text-foreground">{tenant.name}</strong> to your archives. If this is the last active tenant, the property status will revert to Vacant.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3 mt-6">
                    <AlertDialogCancel className="rounded-2xl font-bold uppercase text-[10px] tracking-widest h-12 flex-1">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} disabled={isArchiving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl font-bold uppercase text-[10px] tracking-widest h-12 flex-1 shadow-lg">
                        {isArchiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Archive Tenant
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
