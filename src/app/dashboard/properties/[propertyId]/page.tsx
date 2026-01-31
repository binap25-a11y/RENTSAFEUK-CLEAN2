'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, Edit, Trash2, MoreVertical, Loader2, AlertTriangle, User, Home, Wrench, CalendarCheck, FileText, Banknote, Shield, Phone, Mail } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
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
    imageUrl: string;
    notes?: string;
    tenancy?: {
        monthlyRent?: number;
        depositAmount?: number;
        depositScheme?: string;
    }
}

interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
}

interface MaintenanceLog {
    id: string;
    title: string;
    status: string;
    reportedDate: Timestamp;
}

interface Inspection {
    id: string;
    type: string;
    status: string;
    scheduledDate: Timestamp;
}

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  // State for data
  const [property, setProperty] = useState<Property | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);

  // State for loading and errors
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!firestore || !propertyId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      const propertyDocRef = doc(firestore, 'properties', propertyId);

      try {
        // Fetch Property
        const propertySnap = await getDoc(propertyDocRef);
        if (!propertySnap.exists()) {
          setError(new Error("Not Found"));
          setIsLoading(false);
          return;
        }
        const propData = { id: propertySnap.id, ...propertySnap.data() } as Property;
        setProperty(propData);

        // Fetch related data in parallel
        const tenantQuery = query(collection(firestore, 'tenants'), where('propertyId', '==', propertyId), where('status', '==', 'Active'), limit(1));
        const maintenanceQuery = query(collection(propertyDocRef, 'maintenanceLogs'), orderBy('reportedDate', 'desc'), limit(3));
        const inspectionQuery = query(collection(propertyDocRef, 'inspections'), orderBy('scheduledDate', 'desc'), limit(3));
        
        const [tenantSnap, maintenanceSnap, inspectionSnap] = await Promise.all([
          getDocs(tenantQuery),
          getDocs(maintenanceQuery),
          getDocs(inspectionQuery),
        ]);

        // Set Tenant
        if (!tenantSnap.empty) {
          const tenantData = tenantSnap.docs[0];
          setTenant({ id: tenantData.id, ...tenantData.data() } as Tenant);
        }

        // Set Maintenance Logs
        setMaintenanceLogs(maintenanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceLog)));

        // Set Inspections
        setInspections(inspectionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Inspection)));

      } catch (err: any) {
        console.error("Firestore error:", err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [firestore, propertyId]);

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
    if (error.message === "Not Found") return notFound();
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
                    <DropdownMenuItem asChild><Link href={`/dashboard/properties/${propertyId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardContent className="p-0"><Image src={property.imageUrl} alt={`Image of ${property.address.street}`} width={800} height={500} className="rounded-t-lg object-cover w-full aspect-video" /></CardContent>
            </Card>

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
              </CardContent>
            </Card>

            {property.address?.postcode && (
                <Card>
                    <CardHeader><CardTitle>Map Location</CardTitle></CardHeader>
                    <CardContent>
                        <div className="aspect-video w-full rounded-lg overflow-hidden border">
                            <iframe
                                width="100%"
                                height="100%"
                                loading="lazy"
                                allowFullScreen
                                referrerPolicy="no-referrer-when-downgrade"
                                src={`https://maps.google.com/maps?q=${encodeURIComponent([property.address.nameOrNumber, property.address.street, property.address.city, property.address.postcode].filter(Boolean).join(', '))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                            ></iframe>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                {maintenanceLogs.length === 0 && inspections.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p> : (
                  <div className="space-y-4">
                    {maintenanceLogs.map(log => <div key={log.id} className="text-sm"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${propertyId}`} className="font-medium hover:underline">{log.title}</Link><p className="text-xs text-muted-foreground">{log.status} - Reported {format(log.reportedDate.toDate(), 'dd/MM/yy')}</p></div>)}
                    {inspections.map(insp => <div key={insp.id} className="text-sm"><Link href={`/dashboard/inspections/${insp.id}?propertyId=${propertyId}`} className="font-medium hover:underline">{insp.type}</Link><p className="text-xs text-muted-foreground">{insp.status} - Scheduled for {format(insp.scheduledDate.toDate(), 'dd/MM/yy')}</p></div>)}
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
