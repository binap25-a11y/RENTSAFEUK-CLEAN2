'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collectionGroup, query, where, limit, onSnapshot, doc } from 'firebase/firestore';

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

  useEffect(() => {
    if (!user || !firestore) return;

    let propUnsub: (() => void) | null = null;

    // Search for the active tenant record linked to this user's email
    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', user.email?.toLowerCase()),
        limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
        if (propUnsub) propUnsub(); // Clean up existing property listener if tenant record changes

        if (!snap.empty) {
            const tenantDoc = snap.docs[0];
            const data = tenantDoc.data();
            const pathSegments = tenantDoc.ref.path.split('/');
            
            // Expected Path: userProfiles/{landlordId}/properties/{propertyId}/tenants/{tenantId}
            const landlordId = pathSegments[1];
            const propertyId = pathSegments[3];
            const tenantId = tenantDoc.id;

            // Fetch specific property context directly
            const propRef = doc(firestore, 'userProfiles', landlordId, 'properties', propertyId);
            propUnsub = onSnapshot(propRef, (propSnap) => {
                if (propSnap.exists()) {
                    setContext({
                        landlordId,
                        propertyId,
                        tenantId,
                        tenantData: data,
                        propertyData: propSnap.data()
                    });
                }
                setIsLoading(false);
            }, (error) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: propRef.path,
                    operation: 'get',
                }));
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'tenants (collectionGroup)',
            operation: 'list',
        }));
        setIsLoading(false);
    });

    return () => {
        unsub();
        if (propUnsub) propUnsub();
    };
  }, [user, firestore]);

  if (isLoading) {
    return (
        <div className="flex h-64 flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Authenticating Portal Access...</p>
        </div>
    );
  }

  if (!context) {
    return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none">
            <CardHeader className="text-center bg-muted/20 pb-8">
                <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 shadow-sm border">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <CardTitle className="font-headline text-xl">Tenancy Not Found</CardTitle>
                <CardDescription className="text-sm font-medium px-4">
                    We couldn't find an active tenancy linked to your email <strong>({user?.email})</strong>. 
                    Please ask your landlord to verify your portal access email address.
                </CardDescription>
            </CardHeader>
            <CardFooter className="pt-6">
                <Button className="w-full font-bold h-11 shadow-lg" asChild>
                    <Link href="/dashboard">Return to Personal Dashboard</Link>
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">
            Welcome Home, {user?.displayName?.split(' ')[0] || 'Tenant'}
          </h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
              <Home className="h-4 w-4 text-primary/40" />
              {context.propertyData?.address?.street}, {context.propertyData?.address?.city}
          </p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-7 px-3 font-bold uppercase tracking-widest text-[10px]">
            Tenant Portal Active
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg border-none hover:bg-muted/5 transition-colors">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5 text-primary" /> Rent Schedule
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">£{context.tenantData.monthlyRent?.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-semibold">
                    Due on the {context.tenantData.rentDueDay || '1st'} of each month
                </p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none hover:bg-muted/5 transition-colors">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Tenancy Type
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-xl font-bold">Rolling AST Contract</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Managed by RentSafeUK Secure Portal</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" /> Direct Contact
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-xs font-medium leading-relaxed">Communicate securely with your landlord regarding your tenancy.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md" asChild>
                    <Link href="/tenant/messages">Open Secure Messenger <ChevronRight className="ml-1 h-3 w-3"/></Link>
                </Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden group">
            <CardHeader className="bg-muted/30 border-b group-hover:bg-muted/50 transition-colors">
                <CardTitle className="text-lg flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> Maintenance Hub</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Found an issue?</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Report repairs with photos instantly</p>
                        </div>
                        <Button size="sm" className="h-10 font-bold px-8 shadow-md" asChild><Link href="/tenant/maintenance">Log Issue</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden group">
            <CardHeader className="bg-muted/30 border-b group-hover:bg-muted/50 transition-colors">
                <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Tenancy Documents</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Legal Compliance</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Access safety certs and agreements</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 shadow-sm" asChild><Link href="/tenant/documents">Browse Files</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
