'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Mail, Phone, Calendar as CalendarIcon, Edit, Archive, Home, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

// Type for a Property document from Firestore
interface Property {
    address: string;
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
    status?: string;
}

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'tenants', id);
  }, [firestore, id]);

  const { data: tenant, isLoading: isLoadingTenant, error } = useDoc<Tenant>(tenantRef);
  
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !tenant?.propertyId) return null;
    return doc(firestore, 'properties', tenant.propertyId);
  }, [firestore, tenant?.propertyId]);

  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  const handleArchive = async () => {
    if (!firestore || !tenant) return;
    const isConfirmed = confirm(`Are you sure you want to archive ${tenant.name}?`);
    if (isConfirmed) {
      try {
        await updateDoc(tenantRef, { status: 'Archived' });
        toast({
          title: 'Tenant Archived',
          description: `${tenant.name} has been moved to the archives.`,
        });
        router.push('/dashboard/tenants');
      } catch (e) {
        console.error('Error archiving tenant:', e);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not archive the tenant. Please try again.',
        });
      }
    }
  };

  const isLoading = isLoadingTenant || isLoadingProperty;

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
  
  if (!tenant) {
    return notFound();
  }

  const startDate = tenant.tenancyStartDate ? (tenant.tenancyStartDate instanceof Date ? tenant.tenancyStartDate : new Date(tenant.tenancyStartDate.seconds * 1000)) : null;
  const endDate = tenant.tenancyEndDate ? (tenant.tenancyEndDate instanceof Date ? tenant.tenancyEndDate : new Date(tenant.tenancyEndDate.seconds * 1000)) : null;

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between gap-4">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/tenants">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                </Button>
                <h1 className="text-2xl font-bold">{tenant.name}</h1>
            </div>
            <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                    <Link href={`/dashboard/tenants/${id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                    </Link>
                </Button>
                {tenant.status !== 'Archived' && (
                    <Button variant="destructive" onClick={handleArchive}>
                        <Archive className="mr-2 h-4 w-4" /> Archive
                    </Button>
                )}
            </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span>{tenant.name}</span>
                </div>
                <div className="flex items-center gap-4">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <a href={`mailto:${tenant.email}`} className="text-primary hover:underline">
                        {tenant.email}
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{tenant.telephone}</span>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Assigned Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                 <div className="flex items-center gap-4">
                    <Home className="h-5 w-5 text-muted-foreground" />
                    {property ? (
                        <Link href={`/dashboard/properties/${tenant.propertyId}`} className="text-primary hover:underline">
                            {property.address}
                        </Link>
                    ) : (
                        <span>Loading property...</span>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
            <CardTitle>Tenancy Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-4">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                    <div>
                        <p className="text-sm text-muted-foreground">Tenancy Start</p>
                        <p>{startDate ? format(startDate, 'PPP') : 'N/A'}</p>
                    </div>
                </div>
                {endDate && (
                    <div className="flex items-start gap-4">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="text-sm text-muted-foreground">Tenancy End</p>
                            <p>{format(endDate, 'PPP')}</p>
                        </div>
                    </div>
                )}
            </div>
             {tenant.notes && (
                 <div className="border-t pt-4 mt-4">
                     <h4 className="text-sm font-semibold mb-2">Notes</h4>
                     <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tenant.notes}</p>
                 </div>
             )}
        </CardContent>
        </Card>
    </div>
  );
}
