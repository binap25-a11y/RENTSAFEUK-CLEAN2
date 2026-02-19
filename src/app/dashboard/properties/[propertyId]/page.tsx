'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, Edit, Trash2, MoreVertical, Loader2, AlertTriangle, User, Home, Wrench, CalendarCheck, FileText, Banknote, Shield, Phone, Mail, MapPin, AlertCircle } from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where, limit } from 'firebase/firestore';
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
import { format } from 'date-fns';


// Interfaces
interface Property {
    id: string;
    ownerId: string;
    address: {
      nameOrNumber?: string;
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
    propertyType: string;
    status: string;
    bedrooms: number;
    bathrooms: number;
    imageUrl?: string;
    notes?: string;
    tenancy?: {
        monthlyRent?: number;
        depositAmount?: number;
        depositScheme?: string;
    };
}

interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    ownerId: string;
    status?: string;
}

interface MaintenanceLog {
    id: string;
    title: string;
    status: string;
    reportedDate: { seconds: number; nanoseconds: number } | Date;
}

interface Inspection {
    id: string;
    type: string;
    status: string;
    scheduledDate: { seconds: number; nanoseconds: number } | Date;
}

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Data Fetching using Hooks ---
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);
  const { data: property, isLoading: isLoadingProperty, error: propertyError } = useDoc<Property>(propertyRef);
  
  const tenantForPropertyQuery = useMemoFirebase(() => {
    if (!user || !firestore || !propertyId) return null;
    return query(
      collection(firestore, 'tenants'),
      where('ownerId', '==', user.uid),
      where('propertyId', '==', propertyId),
      where('status', '==', 'Active'),
      limit(1)
    );
  }, [firestore, user, propertyId]);

  const { data: tenants, isLoading: isLoadingTenants, error: tenantError } = useCollection<Tenant>(tenantForPropertyQuery);
  
  const tenant = useMemo(() => {
    return tenants?.[0] || null;
  }, [tenants]);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
        collection(firestore, 'properties', propertyId, 'maintenanceLogs'), 
        where('ownerId', '==', user.uid)
    );
  }, [firestore, propertyId, user]);
  const { data: allMaintenanceLogs, isLoading: isLoadingMaintenance } = useCollection<MaintenanceLog>(maintenanceQuery);

  const inspectionQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
        collection(firestore, 'properties', propertyId, 'inspections'), 
        where('ownerId', '==', user.uid)
    );
  }, [firestore, propertyId, user]);
  const { data: allInspections, isLoading: isLoadingInspections } = useCollection<Inspection>(inspectionQuery);

  // Client-side filtering
  const maintenanceLogs = useMemo(() => {
    return allMaintenanceLogs?.filter(log => log.status !== 'Cancelled') ?? null;
  }, [allMaintenanceLogs]);

  const openMaintenanceCount = useMemo(() => {
    return maintenanceLogs?.filter(log => log.status === 'Open' || log.status === 'In Progress').length || 0;
  }, [maintenanceLogs]);

  const inspections = useMemo(() => {
    return allInspections?.filter(insp => insp.status !== 'Cancelled') ?? null;
  }, [allInspections]);

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
      setIsDeleting(false);
    }
  };
  
  const safeFormatDate = (date: any, formatStr: string) => {
    if (!date) return 'N/A';
    
    let jsDate: Date;
    if (date instanceof Date) {
      jsDate = date;
    } else if (typeof date === 'object' && date.seconds !== undefined) {
      jsDate = new Date(date.seconds * 1000);
    } else {
      jsDate = new Date(date);
    }

    if (isNaN(jsDate.getTime())) {
      return 'Invalid Date';
    }
    
    try {
      return format(jsDate, formatStr);
    } catch (e) {
      return 'Invalid Date';
    }
  };

  if (isLoadingProperty) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (propertyError || (property && user && property.ownerId !== user.uid)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <Card className="w-full max-w-lg text-center">
            <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">You do not have permission to view this property.</p></CardContent>
            <CardFooter className="flex justify-center"><Button asChild><Link href="/dashboard/properties">Return to Properties</Link></Button></CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!property) return notFound();

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild><Link href="/dashboard/properties"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="text-2xl font-bold font-headline">{[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-muted-foreground text-sm">{`${property.address.city}, ${property.address.postcode}`}</p>
                        {openMaintenanceCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 gap-1 animate-pulse">
                                <AlertCircle className="h-3 w-3" />
                                {openMaintenanceCount} Open Issue{openMaintenanceCount > 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/properties/${property.id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        
        {property.imageUrl && (
            <div className="relative w-full aspect-[21/9] rounded-xl overflow-hidden shadow-md border bg-muted">
                <Image src={property.imageUrl} alt="Property Header" fill className="object-cover" priority />
            </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-headline">Property Overview</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 flex flex-col items-center gap-1">
                      <Home className="h-5 w-5 text-primary mb-1" />
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-center">Type</span>
                      <span className="text-sm font-semibold text-center">{property.propertyType}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 flex flex-col items-center gap-1">
                      <Bed className="h-5 w-5 text-primary mb-1" />
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-center">Bedrooms</span>
                      <span className="text-sm font-semibold">{property.bedrooms}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 flex flex-col items-center gap-1">
                      <Bath className="h-5 w-5 text-primary mb-1" />
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-center">Bathrooms</span>
                      <span className="text-sm font-semibold">{property.bathrooms}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 flex flex-col items-center gap-1">
                      <Badge variant="secondary" className="mb-1">{property.status}</Badge>
                      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-center">Status</span>
                  </div>
              </CardContent>
            </Card>

            {property.tenancy && (property.tenancy.monthlyRent || property.tenancy.depositAmount) && (
              <Card>
                <CardHeader><CardTitle className="font-headline">Tenancy & Financials</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {property.tenancy.monthlyRent && <div className="flex items-start gap-3"><Banknote className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Monthly Rent</p><p className="text-sm text-muted-foreground">£{property.tenancy.monthlyRent.toLocaleString()}</p></div></div>}
                  {property.tenancy.depositAmount && <div className="flex items-start gap-3"><Shield className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Deposit Held</p><p className="text-sm text-muted-foreground">£{property.tenancy.depositAmount.toLocaleString()}</p></div></div>}
                  {property.tenancy.depositScheme && <div className="flex items-start gap-3"><FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Deposit Scheme</p><p className="text-sm text-muted-foreground">{property.tenancy.depositScheme}</p></div></div>}
                </CardContent>
              </Card>
            )}

            {property.notes && (<Card><CardHeader><CardTitle className="font-headline">Notes & Description</CardTitle></CardHeader><CardContent><p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{property.notes}</p></CardContent></Card>)}
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="font-headline">Current Tenant</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {isLoadingTenants ? (
                  <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : tenantError ? (
                    <div className="text-center text-muted-foreground py-4">
                        <p>No active tenant assigned.</p>
                        <Button asChild variant="secondary" className="w-full mt-2">
                          <Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}>Assign Tenant</Link>
                        </Button>
                    </div>
                ) : tenant ? (
                  <>
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-sm font-medium">{tenant.name}</p>
                        <Link href={`/dashboard/tenants/${tenant.id}`} className="text-sm text-primary hover:underline">View Profile</Link>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Email</p>
                        <a href={`mailto:${tenant.email}`} className="text-sm text-muted-foreground hover:underline break-all block">{tenant.email}</a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">{tenant.telephone}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground text-center py-4">No active tenant assigned.</p>
                    <Button asChild variant="secondary" className="w-full">
                      <Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}>Assign Tenant</Link>
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle className="font-headline">Location</CardTitle></CardHeader>
              <CardContent>
                  {property.address && property.address.postcode ? (
                    <div className="aspect-square w-full rounded-md overflow-hidden border shadow-inner">
                        <iframe
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          title="Property Map"
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(
                            [property.address.street, property.address.city, property.address.postcode].filter(Boolean).join(', ')
                          )}&output=embed`}
                        ></iframe>
                    </div>
                  ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">Address details incomplete for map display.</p>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="font-headline">Open Issues</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/maintenance/logged?propertyId=${propertyId}`}>View All</Link>
                  </Button>
              </CardHeader>
              <CardContent>
                {isLoadingMaintenance || isLoadingInspections ? <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin" /></div>
                : !maintenanceLogs?.filter(l => l.status === 'Open' || l.status === 'In Progress').length && !inspections?.filter(i => i.status === 'Scheduled').length ? <p className="text-sm text-muted-foreground text-center py-4">All clear. No open maintenance issues.</p> : (
                  <div className="space-y-4">
                    {maintenanceLogs?.filter(l => l.status === 'Open' || l.status === 'In Progress').slice(0, 3).map(log => <div key={log.id} className="text-sm border-l-2 border-destructive pl-3 py-1"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${propertyId}`} className="font-medium hover:underline block">{log.title}</Link><p className="text-xs text-muted-foreground">{log.status} • {safeFormatDate(log.reportedDate, 'dd MMM')}</p></div>)}
                    {inspections?.filter(i => i.status === 'Scheduled').slice(0, 3).map(insp => <div key={insp.id} className="text-sm border-l-2 border-accent pl-3 py-1"><Link href={`/dashboard/inspections/${insp.id}?propertyId=${propertyId}`} className="font-medium hover:underline block">{insp.type}</Link><p className="text-xs text-muted-foreground">{insp.status} • Scheduled for {safeFormatDate(insp.scheduledDate, 'dd MMM')}</p></div>)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Property?</AlertDialogTitle><AlertDialogDescription>This will move the property to your archive. You can restore it later if needed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteConfirm}>Archive Property</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
