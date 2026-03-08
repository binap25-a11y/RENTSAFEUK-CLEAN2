
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Wrench, 
  MessageSquare, 
  FileText, 
  Loader2, 
  Calendar, 
  Banknote,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit, onSnapshot, collection } from 'firebase/firestore';
import { format } from 'date-fns';

interface TenantContext {
    landlordId: string;
    propertyId: string;
    tenantId: string;
    tenantData: any;
    propertyData: any;
}

export default function TenantDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [context, setContext] = useState<TenantContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Discover tenant record across all landlord portfolios
  useEffect(() => {
    if (!user || !firestore) return;

    // Search for any tenant record that has this user's UID (or email as fallback)
    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', user.email?.toLowerCase()),
        limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
            const tenantDoc = snap.docs[0];
            const data = tenantDoc.data();
            const pathSegments = tenantDoc.ref.path.split('/');
            // Path: userProfiles/{landlordId}/properties/{propertyId}/tenants/{tenantId}
            const landlordId = pathSegments[1];
            const propertyId = pathSegments[3];
            const tenantId = tenantDoc.id;

            // Fetch property context
            const propUnsub = onSnapshot(collection(firestore, 'userProfiles', landlordId, 'properties').withConverter(null), (propSnap) => {
                const property = propSnap.docs.find(d => d.id === propertyId)?.data();
                setContext({
                    landlordId,
                    propertyId,
                    tenantId,
                    tenantData: data,
                    propertyData: property
                });
                setIsLoading(false);
            });
            return () => propUnsub();
        } else {
            setIsLoading(false);
        }
    });

    return () => unsub();
  }, [user, firestore]);

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!context) {
    return (
        <Card className="max-w-md mx-auto mt-20">
            <CardHeader className="text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <CardTitle>Tenancy Not Found</CardTitle>
                <CardDescription>We couldn't find an active tenancy linked to your email ({user?.email}). Please contact your landlord to ensure your portal access is set up.</CardDescription>
            </CardHeader>
            <CardFooter><Button className="w-full" asChild><Link href="/dashboard">Refresh Access</Link></Button></CardFooter>
        </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Welcome Home, {user?.displayName?.split(' ')[0] || 'Tenant'}</h1>
          <p className="text-muted-foreground font-medium">{context.propertyData?.address?.street}, {context.propertyData?.address?.city}</p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-7 px-3">Active Tenancy</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Rent Schedule
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">£{context.tenantData.monthlyRent?.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Due on the {context.tenantData.rentDueDay || '1st'} of each month</p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Tenancy Period
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold">Rolling Contract</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Managed via RentSafeUK Portfolio</p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-80 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Quick Message
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-xs font-medium leading-relaxed">Need to contact your landlord? Send a secure message instantly.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9" asChild><Link href="/tenant/messages">Start Chat <ChevronRight className="ml-1 h-3 w-3"/></Link></Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> Maintenance Hub</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Something broken?</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Report repairs instantly with photos</p>
                        </div>
                        <Button size="sm" className="h-9 font-bold px-6" asChild><Link href="/tenant/maintenance">Log Repair</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> My Documents</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Agreements & Certs</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">View legal compliance documents</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-9 font-bold px-6" asChild><Link href="/tenant/documents">View All</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
