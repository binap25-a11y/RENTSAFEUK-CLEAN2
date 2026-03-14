
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
  Banknote,
  Send,
  ShieldCheck,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import { doc, collection, query, updateDoc, where, getDocs, limit } from 'firebase/firestore';
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
    landlordId: string;
    monthlyRent?: number;
    rentDueDay?: number;
    tenancyStartDate: any;
    tenancyEndDate?: any;
    notes?: string;
    status?: string;
    userId: string;
    lastReminderSent?: any;
    inviteSentDate?: any;
    joinedDate?: any;
    verified?: boolean;
}

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
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUpdatingInvite, setIsUpdatingInvite] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !id || !user) return null;
    return doc(firestore, 'tenants', id);
  }, [firestore, id, user]);
  
  const { data: tenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !tenant?.propertyId || !user) return null;
    return doc(firestore, 'properties', tenant.propertyId);
  }, [firestore, tenant?.propertyId, user]);
  const { data: property } = useDoc<Property>(propertyRef);
  
  const handleSendInvite = async () => {
    if (!tenant || !property || !user || !firestore || !tenantRef) return;
    setIsUpdatingInvite(true);
    
    try {
        const appUrl = window.location.origin;
        const propertyAddr = property.address.street || 'the property';
        
        const subject = `Resident Portal Invite - ${propertyAddr}`;
        const body = `Hi ${tenant.name},\n\nJoin your portal for ${propertyAddr} at:\n${appUrl}\n\nEmail: ${tenant.email}\n\n- Landlord Support`;
        
        const mailtoUrl = `mailto:${tenant.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        window.location.href = mailtoUrl;
        
        await updateDoc(tenantRef, { inviteSentDate: new Date().toISOString() });
        
        toast({ title: 'Portal Invite Sent', description: 'Opening email client...' });
    } catch (e) {
        console.error("Invite failed:", e);
        toast({ variant: 'destructive', title: 'Action Failed' });
    } finally {
        setIsUpdatingInvite(false);
    }
  };

  const handleSyncIdentity = async () => {
      if (!tenantRef) return;
      setIsSyncing(true);
      toast({ title: "Synchronizing Registry", description: "Fetching latest verification state..." });
      updateDoc(tenantRef, { lastSyncCheck: new Date().toISOString() })
        .finally(() => {
            setTimeout(() => setIsSyncing(false), 800);
        });
  };

  const handleSendReminder = async () => {
    if (!tenant || !property || !user || !firestore || !tenantRef) return;
    
    const propertyAddr = property.address.street || 'Assigned Property';
    const subject = encodeURIComponent(`Rent Reminder: ${propertyAddr}`);
    const body = encodeURIComponent(`Hi ${tenant.name},\n\nA friendly reminder that rent for ${propertyAddr} is due on the ${tenant.rentDueDay || '1st'}.\n\nRent: £${tenant.monthlyRent?.toLocaleString() || '0'}`);
    
    window.location.href = `mailto:${tenant.email}?subject=${subject}&body=${body}`;
    
    updateDoc(tenantRef, { lastReminderSent: new Date().toISOString() });
    
    toast({ title: 'Reminder Prepared', description: 'Email client opened.' });
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !tenant || !propertyRef || !tenantRef) return;
    setIsArchiving(true);

    try {
        // 1. Mark Tenant as Archived
        await updateDoc(tenantRef, { status: 'Archived' });

        // 2. Atomic Status Sync: Check for remaining active residents
        const activeTenantsQuery = query(
            collection(firestore, 'tenants'),
            where('propertyId', '==', tenant.propertyId),
            where('status', '==', 'Active'),
            limit(5)
        );
        const activeTenantsSnap = await getDocs(activeTenantsQuery);
        
        // If this was the last active tenant, transition property to Vacant
        if (activeTenantsSnap.empty) {
            await updateDoc(propertyRef, { status: 'Vacant' });
        }

        toast({ title: 'Tenant Archived', description: 'Identity record moved to history and asset status updated.' });
        router.push('/dashboard/tenants');
    } catch (e) {
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
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Resolving Identity...</p>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="bg-muted p-6 rounded-full"><AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" /></div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Record Not Found</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">This record may have been deleted.</p>
        </div>
        <Button asChild variant="outline"><Link href="/dashboard/tenants">Return to Tenants</Link></Button>
      </div>
    );
  }

  const propertyAddress = [property?.address.nameOrNumber, property?.address.street, property?.address.city, property?.address.postcode].filter(Boolean).join(', ') || 'N/A';
  
  const isVerified = tenant.verified === true || !!tenant.joinedDate;

  return (
    <div className="flex flex-col gap-6 text-left">
        <div className="flex flex-col gap-4 text-left">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild className="shrink-0">
                    <Link href="/dashboard/tenants"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap text-left">
                        <h1 className="text-2xl font-bold font-headline leading-tight break-words">{tenant.name}</h1>
                        {isVerified ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 gap-1.5 font-bold uppercase text-[9px]">
                                <ShieldCheck className="h-3 w-3" /> Verified Resident
                            </Badge>
                        ) : (
                            <Badge variant="secondary" className="gap-1.5 font-bold uppercase text-[9px]">
                                <Loader2 className="h-3 w-3 animate-spin" /> Handshake Pending
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">Registry Record</p>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button variant={isVerified ? "outline" : "default"} onClick={isVerified ? handleSyncIdentity : handleSendInvite} disabled={isUpdatingInvite || isSyncing} className="gap-2 font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-lg">
                    {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isVerified ? <RefreshCw className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                    {isVerified ? 'Sync Identity' : (tenant.inviteSentDate ? 'Resend Portal Invite' : 'Send Verification Invite')}
                </Button>
                <Button variant="outline" onClick={handleSendReminder} className="gap-2 font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-sm border-primary/20 hover:bg-primary/5">
                    <BellRing className="h-3.5 w-3.5 text-primary" /> Send Rent Nudge
                </Button>
                <Button variant="outline" asChild className="h-10 px-6 font-bold uppercase tracking-widest text-[10px] shadow-sm border-primary/20 hover:bg-primary/5">
                    <Link href={`/dashboard/tenants/${id}/edit`}>
                        <Edit className="mr-2 h-3.5 w-3.5 text-primary" /> Edit Profile
                    </Link>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 border shadow-none">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive font-bold cursor-pointer">
                            <Trash2 className="mr-2 h-4 w-4" /> Archive Tenant
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <div className="flex flex-col gap-6 text-left">
            {!isVerified && (
                <Card className="border-primary/20 bg-primary/5 shadow-inner">
                    <CardContent className="flex items-center gap-4 py-4 text-left">
                        <div className="p-2.5 rounded-full bg-primary/10 text-primary shrink-0"><AlertCircle className="h-5 w-5" /></div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-primary">Verification Handshake Required</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">This tenant has not yet accessed the Resident Hub. Shared maintenance tracking and document sync will be inactive until verified.</p>
                        </div>
                        <Button size="sm" onClick={handleSendInvite} className="font-bold text-[10px] uppercase shadow-sm">Send Invite</Button>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-lg border-none text-left">
                <CardHeader className="pb-4 bg-muted/20 border-b text-left">
                    <CardTitle className="text-lg font-headline">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6 text-left">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-sm transition-all hover:border-primary/20 text-left">
                            <div className="p-2.5 rounded-full bg-primary/10 text-primary shrink-0"><Mail className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1 text-left">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Verified Identity Key</p>
                                <a href={`mailto:${tenant.email}`} className="font-bold text-primary hover:underline break-all block text-sm">{tenant.email}</a>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 p-4 rounded-xl bg-background border shadow-sm transition-all hover:border-primary/20 text-left">
                            <div className="p-2.5 rounded-full bg-primary/10 text-primary shrink-0"><Phone className="h-4 w-4" /></div>
                            <div className="min-w-0 flex-1 text-left">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Mobile Phone</p>
                                <p className="font-bold text-sm">{tenant.telephone}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-lg border-none text-left">
                <CardHeader className="pb-4 bg-muted/20 border-b text-left">
                    <CardTitle className="text-lg font-headline">Tenancy Agreement Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6 text-left">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-background border shadow-sm flex items-start gap-4 text-left">
                            <div className="p-2.5 rounded-lg bg-green-50 text-green-600 shrink-0"><Banknote className="h-5 w-5" /></div>
                            <div className="text-left">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Agreed Rent</p>
                                <p className="font-bold text-xl">£{tenant.monthlyRent?.toLocaleString() || '0'}<span className="text-xs font-medium text-muted-foreground"> /mo</span></p>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl bg-background border shadow-sm flex items-start gap-4 text-left">
                            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0"><CalendarDays className="h-5 w-5" /></div>
                            <div className="text-left">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] mb-0.5">Rent Due Date</p>
                                <p className="font-bold text-xl">{tenant.rentDueDay || '1'}<span className="text-xs font-medium text-muted-foreground">{[1, 21, 31].includes(tenant.rentDueDay || 1) ? 'st' : [2, 22].includes(tenant.rentDueDay || 1) ? 'nd' : [3, 23].includes(tenant.rentDueDay || 1) ? 'rd' : 'th'} of month</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="p-5 rounded-xl bg-muted/30 border border-dashed flex flex-col gap-4 text-left">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Contract Timeline
                        </div>
                        <div className="flex items-center gap-8 text-left">
                            <div className="flex-1 text-left">
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
            
            <Card className="shadow-lg border-none overflow-hidden text-left">
                <CardHeader className="pb-4 bg-muted/20 border-b text-left"><CardTitle className="text-lg font-headline">Assigned Asset</CardTitle></CardHeader>
                <CardContent className="pt-6 text-left">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-4 rounded-xl bg-background border shadow-sm text-left">
                        <div className="flex items-start gap-4 flex-1 min-w-0 text-left">
                            <div className="p-2.5 rounded-lg bg-muted/50 text-primary shrink-0 mt-1"><MapPin className="h-5 w-5" /></div>
                            <div className="min-w-0 flex-1 text-left">
                                <Link href={`/dashboard/properties/${tenant.propertyId}`} className="text-lg font-bold text-primary hover:underline leading-tight block whitespace-normal text-left">{propertyAddress}</Link>
                                <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest border-primary/20 bg-primary/5 text-primary mt-2">Active Lease</Badge>
                            </div>
                        </div>
                        <Button variant="outline" asChild className="shrink-0 w-full md:w-auto h-11 px-8 font-bold shadow-sm uppercase tracking-widest text-[10px]"><Link href={`/dashboard/properties/${tenant.propertyId}`}><Home className="mr-2 h-4 w-4" />Property Hub</Link></Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="rounded-2xl border-none shadow-2xl text-left">
                <AlertDialogHeader className='text-left'>
                    <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4"><Trash2 className="h-8 w-8 text-destructive" /></div>
                    <AlertDialogTitle className="text-xl font-headline text-center">Archive tenant record?</AlertDialogTitle>
                    <AlertDialogDescription className="text-base font-medium text-center">This will move <strong className="text-foreground">{tenant.name}</strong> to your archives. Access to the Resident Hub will be revoked.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3 mt-6">
                    <AlertDialogCancel className="rounded-2xl font-bold uppercase text-[10px] h-12 flex-1">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConfirm} disabled={isArchiving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl font-bold uppercase text-[10px] h-12 flex-1 shadow-lg">
                        {isArchiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Archive Tenant
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
