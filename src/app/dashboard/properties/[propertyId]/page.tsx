
'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, Edit, Trash2, MoreVertical, Loader2, AlertTriangle, User, Home, Wrench, CalendarCheck, FileText, Banknote, Shield, Phone, Mail, MapPin } from 'lucide-react';
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
    notes?: string;
    tenancy?: {
        monthlyRent?: number;
        depositAmount?: number;
        depositScheme?: string;
    };
    location?: {
        lat: number;
        lng: number;
    };
}

interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    ownerId: string;
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
    if (!firestore || !propertyId) return null; // Guard against missing firestore/propertyId
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);
  const { data: property, isLoading: isLoadingProperty, error: propertyError } = useDoc<Property>(propertyRef);

  const tenantQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
      collection(firestore, 'tenants'),
      where('ownerId', '==', user.uid),
      where('propertyId', '==', propertyId),
      where('status', '==', 'Active'),
      limit(1)
    );
  }, [firestore, propertyId, user]);
  const { data: tenants, isLoading: isLoadingTenant } = useCollection<Tenant>(tenantQuery);
  const tenant = useMemo(() => tenants?.[0], [tenants]);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(collection(firestore, 'properties', propertyId, 'maintenanceLogs'), where('status', '!=', 'Cancelled'), limit(3));
  }, [firestore, propertyId]);
  const { data: maintenanceLogs, isLoading: isLoadingMaintenance } = useCollection<MaintenanceLog>(maintenanceQuery);

  const inspectionQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return query(collection(firestore, 'properties', propertyId, 'inspections'), where('status', '!=', 'Cancelled'), limit(3));
  }, [firestore, propertyId]);
  const { data: inspections, isLoading: isLoadingInspections } = useCollection<Inspection>(inspectionQuery);

  const isLoading = isLoadingProperty || isLoadingTenant || isLoadingMaintenance || isLoadingInspections;
  const error = propertyError; // For now, we only show the main property error.

  const hasPermission = useMemo(() => {
    if (!property || !user) return false;
    return property.ownerId === user.uid;
  }, [property, user]);

  const handleDeleteConfirm = async () => {
    if (!firestore || !property) return;
    
    setIsDeleting(true);
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
  
  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error) {
    const isPermissionError = error.message.includes('permission-denied') || (error as any).code === 'permission-denied';
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <Card className="w-full max-w-lg text-center">
            <CardHeader><CardTitle>{isPermissionError ? "Access Denied" : "Error Loading Property"}</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{isPermissionError ? "You do not have permission to view this property." : "An unexpected error occurred."}</p></CardContent>
            <CardFooter className="flex justify-center"><Button asChild><Link href="/dashboard/properties">Return to Properties</Link></Button></CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!property) return notFound();
  
  if (!hasPermission) {
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

  const safeFormatDate = (date: { seconds: number; nanoseconds: number } | Date, formatStr: string) => {
    const jsDate = date instanceof Date ? date : new Date(date.seconds * 1000);
    return format(jsDate, formatStr);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild><Link href="/dashboard/properties"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div>
                    <h1 className="text-2xl font-bold">{[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}</h1>
                    <p className="text-muted-foreground">{`${property.address.city}, ${property.address.county ? property.address.county + ', ' : ''}${property.address.postcode}`}</p>
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
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {property.tenancy && (property.tenancy.monthlyRent || property.tenancy.depositAmount) && (
              <Card>
                <CardHeader><CardTitle>Tenancy & Financials</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {property.tenancy.monthlyRent && <div className="flex items-start gap-3"><Banknote className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Monthly Rent</p><p className="text-sm text-muted-foreground">£{property.tenancy.monthlyRent.toLocaleString()}</p></div></div>}
                  {property.tenancy.depositAmount && <div className="flex items-start gap-3"><Shield className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Deposit Held</p><p className="text-sm text-muted-foreground">£{property.tenancy.depositAmount.toLocaleString()}</p></div></div>}
                  {property.tenancy.depositScheme && <div className="flex items-start gap-3"><FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Deposit Scheme</p><p className="text-sm text-muted-foreground">{property.tenancy.depositScheme}</p></div></div>}
                </CardContent>
              </Card>
            )}

            {property.notes && (<Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent><p className="text-muted-foreground whitespace-pre-wrap">{property.notes}</p></CardContent></Card>)}
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Property Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                  <div className="flex items-start gap-3"><Home className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Type</p><p className="text-sm text-muted-foreground">{property.propertyType}</p></div></div>
                  <div className="flex items-start gap-3"><Badge variant="secondary" className="mt-1">{property.status}</Badge></div>
                  <div className="flex items-start gap-3"><Bed className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Bedrooms</p><p className="text-sm text-muted-foreground">{property.bedrooms}</p></div></div>
                  <div className="flex items-start gap-3"><Bath className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Bathrooms</p><p className="text-sm text-muted-foreground">{property.bathrooms}</p></div></div>
                  {property.address && property.address.postcode && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Location</h4>
                      <div className="aspect-video w-full rounded-md overflow-hidden border">
                        <iframe
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(
                            [property.address.street, property.address.city, property.address.postcode].filter(Boolean).join(', ')
                          )}&output=embed`}
                        ></iframe>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Current Tenant</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {tenant ? (
                  <>
                    <div className="flex items-start gap-3"><User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">{tenant.name}</p><Link href={`/dashboard/tenants/${tenant.id}`} className="text-sm text-primary hover:underline">View Profile</Link></div></div>
                    <div className="flex items-start gap-3"><Mail className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Email</p><a href={`mailto:${tenant.email}`} className="text-sm text-muted-foreground hover:underline">{tenant.email}</a></div></div>
                    <div className="flex items-start gap-3"><Phone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" /><div><p className="text-sm font-medium">Phone</p><p className="text-sm text-muted-foreground">{tenant.telephone}</p></div></div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground text-center py-4">No active tenant assigned.</p>
                    <Button asChild variant="secondary" className="w-full"><Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}>Assign Tenant</Link></Button>
                  </>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
              <CardContent>
                {!maintenanceLogs?.length && !inspections?.length ? <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p> : (
                  <div className="space-y-4">
                    {maintenanceLogs?.map(log => <div key={log.id} className="text-sm"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${propertyId}`} className="font-medium hover:underline">{log.title}</Link><p className="text-xs text-muted-foreground">{log.status} - Reported {safeFormatDate(log.reportedDate, 'dd/MM/yy')}</p></div>)}
                    {inspections?.map(insp => <div key={insp.id} className="text-sm"><Link href={`/dashboard/inspections/${insp.id}?propertyId=${propertyId}`} className="font-medium hover:underline">{insp.type}</Link><p className="text-xs text-muted-foreground">{insp.status} - Scheduled for {safeFormatDate(insp.scheduledDate, 'dd/MM/yy')}</p></div>)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will archive the property. You can restore it later.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteConfirm}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
    