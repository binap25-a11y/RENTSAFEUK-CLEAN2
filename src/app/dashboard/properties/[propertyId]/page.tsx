'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Bed, 
  Bath, 
  Edit, 
  Trash2, 
  MoreVertical, 
  Loader2, 
  AlertTriangle, 
  User, 
  Home, 
  Wrench, 
  CalendarCheck, 
  FileText, 
  Banknote, 
  Shield, 
  Phone, 
  Mail, 
  MapPin, 
  AlertCircle,
  PlusCircle,
  ChevronRight,
  Images
} from 'lucide-react';
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
    additionalImageUrls?: string[];
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

  // --- Data Fetching ---
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  const { data: property, isLoading: isLoadingProperty, error: propertyError } = useDoc<Property>(propertyRef);
  
  const tenantsForPropertyQuery = useMemoFirebase(() => {
    if (!user || !firestore || !propertyId) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants'),
      where('status', '==', 'Active')
    );
  }, [firestore, user, propertyId]);

  const { data: activeTenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsForPropertyQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return collection(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'maintenanceLogs');
  }, [firestore, propertyId, user]);
  const { data: allMaintenanceLogs } = useCollection<MaintenanceLog>(maintenanceQuery);

  const inspectionQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return collection(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'inspections');
  }, [firestore, propertyId, user]);
  const { data: allInspections } = useCollection<Inspection>(inspectionQuery);

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
    if (!firestore || !user || !property) return;
    try {
      const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
      await updateDoc(docRef, { status: 'Deleted' });
      toast({ title: 'Property Deleted', description: `${property.address.street} has been moved to the deleted list.` });
      router.push('/dashboard/properties');
    } catch (e) {
      console.error('Error deleting property:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the property.' });
    } finally { setIsDeleting(false); }
  };
  
  const safeFormatDate = (date: any, formatStr: string) => {
    if (!date) return 'N/A';
    let jsDate: Date;
    if (date instanceof Date) jsDate = date;
    else if (typeof date === 'object' && date.seconds !== undefined) jsDate = new Date(date.seconds * 1000);
    else jsDate = new Date(date);
    if (isNaN(jsDate.getTime())) return 'Invalid Date';
    try { return format(jsDate, formatStr); } catch (e) { return 'Invalid Date'; }
  };

  if (isLoadingProperty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading property details...</p>
      </div>
    );
  }

  if (propertyError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-6">
        <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
        <h2 className="text-lg font-bold">Failed to Load Property</h2>
        <Button asChild variant="outline"><Link href="/dashboard/properties">Return to Portfolio</Link></Button>
      </div>
    );
  }
  
  if (!property) return <div className="text-center py-20"><p>Property not found.</p></div>;

  const propertyAddressTitle = [property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ');
  const propertyAddressSubtitle = [property.address.city, property.address.county, property.address.postcode].filter(Boolean).join(', ');

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-hidden">
                <Button variant="outline" size="icon" asChild className="shrink-0"><Link href="/dashboard/properties"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold font-headline leading-tight break-words">{propertyAddressTitle}</h1>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                        <p className="text-muted-foreground text-sm font-medium">{propertyAddressSubtitle}</p>
                        {openMaintenanceCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 gap-1 animate-pulse shrink-0">
                                <AlertCircle className="h-3 w-3" />
                                {openMaintenanceCount} Open Issue{openMaintenanceCount > 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/properties/${property.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
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
            <Card className="shadow-sm">
              <CardHeader className="pb-4"><CardTitle className="font-headline text-lg">Property Overview</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t bg-muted/5">
                  <div className="p-4 rounded-lg bg-background border flex flex-col items-center gap-1 shadow-sm">
                      <Home className="h-5 w-5 text-primary mb-1" />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-center">Type</span>
                      <span className="text-sm font-semibold text-center">{property.propertyType}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-background border flex flex-col items-center gap-1 shadow-sm">
                      <Bed className="h-5 w-5 text-primary mb-1" />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-center">Bedrooms</span>
                      <span className="text-sm font-semibold">{property.bedrooms}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-background border flex flex-col items-center gap-1 shadow-sm">
                      <Bath className="h-5 w-5 text-primary mb-1" />
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-center">Bathrooms</span>
                      <span className="text-sm font-semibold">{property.bathrooms}</span>
                  </div>
                  <div className="p-4 rounded-lg bg-background border flex flex-col items-center gap-1 shadow-sm">
                      <Badge variant="secondary" className="mb-1 text-[10px] uppercase font-bold">{property.status}</Badge>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-center">Status</span>
                  </div>
              </CardContent>
            </Card>

            {property.additionalImageUrls && property.additionalImageUrls.length > 0 && (
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <CardTitle className="font-headline text-lg">Property Gallery</CardTitle>
                        <Images className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="pt-6 border-t bg-muted/5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {property.additionalImageUrls.map((url, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border shadow-sm cursor-zoom-in hover:scale-[1.02] transition-transform">
                                    <Link href={url} target="_blank">
                                        <Image src={url} alt={`Gallery ${idx + 1}`} fill className="object-cover" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {property.tenancy && (property.tenancy.monthlyRent || property.tenancy.depositAmount) && (
              <Card className="shadow-sm">
                <CardHeader className="pb-4"><CardTitle className="font-headline text-lg">Tenancy & Financials</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t bg-muted/5">
                  {property.tenancy.monthlyRent && (
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Banknote className="h-5 w-5 text-primary" /></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Rent</p><p className="font-bold text-foreground">£{property.tenancy.monthlyRent.toLocaleString()}</p></div>
                    </div>
                  )}
                  {property.tenancy.depositAmount && (
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Shield className="h-5 w-5 text-primary" /></div>
                        <div><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Deposit</p><p className="font-bold text-foreground">£{property.tenancy.depositAmount.toLocaleString()}</p></div>
                    </div>
                  )}
                  {property.tenancy.depositScheme && (
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0"><FileText className="h-5 w-5 text-primary" /></div>
                        <div className="min-w-0"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Scheme</p><p className="font-bold text-foreground break-words">{property.tenancy.depositScheme}</p></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {property.notes && (
                <Card className="shadow-sm">
                    <CardHeader className="pb-4"><CardTitle className="font-headline text-lg">Notes & Description</CardTitle></CardHeader>
                    <CardContent className="pt-6 border-t bg-muted/5">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{property.notes}</p>
                    </CardContent>
                </Card>
            )}
          </div>
          
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="font-headline text-lg">Active Tenants</CardTitle>
                <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                  <Link href={`/dashboard/tenants/add?propertyId=${propertyId}`} title="Add Tenant"><PlusCircle className="h-5 w-5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-6 border-t bg-muted/5">
                {isLoadingTenants ? (
                  <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : activeTenants && activeTenants.length > 0 ? (
                  <div className="space-y-4">
                    {activeTenants.map((tenant) => (
                      <div key={tenant.id} className="p-4 rounded-xl bg-background border shadow-sm group hover:border-primary/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-primary/10 text-primary"><User className="h-4 w-4" /></div>
                            <p className="font-bold text-foreground truncate max-w-[140px]">{tenant.name}</p>
                          </div>
                          <Button variant="ghost" size="icon" asChild className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${propertyId}`}><ChevronRight className="h-4 w-4" /></Link>
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground overflow-hidden"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{tenant.email}</span></div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3 w-3 shrink-0" /><span>{tenant.telephone}</span></div>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" className="w-full text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/5 h-10 border border-dashed border-primary/20" asChild>
                        <Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}>
                            <PlusCircle className="mr-2 h-3 w-3" /> Add Another Tenant
                        </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-4 italic">No active tenants assigned.</p>
                    <Button asChild variant="secondary" className="w-full shadow-sm"><Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}>Assign Tenant</Link></Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="shadow-sm">
              <CardHeader className="pb-4"><CardTitle className="font-headline text-lg">Location</CardTitle></CardHeader>
              <CardContent className="pt-6 border-t bg-muted/5">
                  {property.address && property.address.postcode ? (
                    <div className="aspect-square w-full rounded-md overflow-hidden border shadow-inner">
                        <iframe width="100%" height="100%" style={{ border: 0 }} title="Property Map" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent([property.address.street, property.address.city, property.address.county, property.address.postcode].filter(Boolean).join(', '))}&output=embed`}></iframe>
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-4">Address details incomplete.</p>}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="font-headline text-lg">Timeline</CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-xs font-bold h-8"><Link href={`/dashboard/maintenance/logged?propertyId=${propertyId}`}>History</Link></Button>
              </CardHeader>
              <CardContent className="pt-6 border-t bg-muted/5">
                {(!maintenanceLogs?.filter(l => l.status === 'Open' || l.status === 'In Progress').length && !inspections?.filter(i => i.status === 'Scheduled').length) ? 
                  <p className="text-xs text-muted-foreground text-center py-4 italic">No active maintenance or scheduled inspections.</p> : (
                  <div className="space-y-4">
                    {maintenanceLogs?.filter(l => l.status === 'Open' || l.status === 'In Progress').slice(0, 3).map(log => <div key={log.id} className="text-sm border-l-4 border-destructive pl-3 py-1 bg-background rounded-r shadow-sm"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${propertyId}`} className="font-bold hover:underline">{log.title}</Link><p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">{log.status} • {safeFormatDate(log.reportedDate, 'dd MMM')}</p></div>)}
                    {inspections?.filter(i => i.status === 'Scheduled').slice(0, 3).map(insp => <div key={insp.id} className="text-sm border-l-4 border-primary pl-3 py-1 bg-background rounded-r shadow-sm"><Link href={`/dashboard/inspections/${insp.id}?propertyId=${propertyId}`} className="font-bold hover:underline">{insp.type}</Link><p className="text-[10px] font-bold text-muted-foreground/70 mt-0.5">Scheduled • {safeFormatDate(insp.scheduledDate, 'dd MMM')}</p></div>)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Archive Property?</AlertDialogTitle><AlertDialogDescription>This will move the property to your archive. You can restore it later if needed.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeleteConfirm}>Archive Property</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
