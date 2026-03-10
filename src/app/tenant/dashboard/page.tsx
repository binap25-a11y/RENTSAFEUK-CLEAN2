'use client';

import { useEffect, useState, useCallback } from 'react';
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
  ChevronRight,
  UserCircle,
  ShieldCheck,
  Sparkles,
  RefreshCw
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
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [context, setContext] = useState<TenantContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performDiscovery = useCallback(() => {
    if (!user || !firestore || !user.email) {
      setIsLoading(false);
      return () => {};
    }

    setIsLoading(true);
    setError(null);
    
    // Normalize user email for secure discovery
    const userEmail = user.email.toLowerCase().trim();

    // High-performance discovery query using collectionGroup
    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', userEmail),
        limit(10)
    );

    let propUnsub: (() => void) | null = null;

    const unsub = onSnapshot(q, (snap) => {
        if (propUnsub) propUnsub();

        // Find the first active tenancy doc for this email
        const activeTenantDoc = snap.docs.find(d => d.data().status === 'Active');

        if (activeTenantDoc) {
            const data = activeTenantDoc.data();
            const path = activeTenantDoc.ref.path;
            const segments = path.split('/');
            
            // Reconstruct landlord and property IDs from the document path
            const landlordId = segments[segments.indexOf('userProfiles') + 1];
            const propertyId = segments[segments.indexOf('properties') + 1];
            const tenantId = activeTenantDoc.id;

            if (landlordId && propertyId) {
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
                    } else {
                        setError("Property details could not be resolved.");
                    }
                    setIsLoading(false);
                    setIsIndexBuilding(false);
                }, async (err) => {
                    // Standard Firestore permission error handling
                    const permissionError = new FirestorePermissionError({
                        path: propRef.path,
                        operation: 'get',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    
                    setError("Portal access restricted by security policies.");
                    setIsLoading(false);
                    setIsIndexBuilding(false);
                });
            } else {
                setIsLoading(false);
                setIsIndexBuilding(false);
            }
        } else {
            // Discovery returned no active records
            setIsLoading(false);
            setIsIndexBuilding(false);
            setContext(null);
        }
    }, async (err) => {
        const msg = err.message.toLowerCase();
        if (msg.includes('index') || err.code === 'failed-precondition') {
            setIsIndexBuilding(true);
        } else {
            // Standard Firestore permission error handling for collection group
            const permissionError = new FirestorePermissionError({
                path: 'tenants (collectionGroup)',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
            
            setError("Connection Error: Portal access restricted by security policies.");
        }
        setIsLoading(false);
    });

    return () => {
        unsub();
        if (propUnsub) propUnsub();
    };
  }, [user, firestore]);

  useEffect(() => {
    if (!isUserLoading) {
        return performDiscovery();
    }
  }, [isUserLoading, performDiscovery]);

  if (isUserLoading || (isLoading && !isIndexBuilding)) {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Verifying Tenant Identity...</p>
        </div>
    );
  }

  if (isIndexBuilding) {
    return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="relative">
                <div className="bg-primary/10 p-8 rounded-full w-fit mx-auto relative z-10">
                    <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-150" />
            </div>
            <div className="space-y-3 px-4">
                <h2 className="font-headline text-2xl font-bold text-primary">Establishing Connection</h2>
                <p className="text-muted-foreground font-medium leading-relaxed">
                    Our cloud system is synchronizing your tenant records for private access. This process ensures your data remains secure.
                </p>
            </div>
            <div className="flex flex-col items-center gap-4">
                <Button variant="outline" className="font-bold h-11 px-10 rounded-xl border-primary/20 hover:bg-primary/5 uppercase tracking-widest text-[10px]" onClick={() => window.location.reload()}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh Portal Status
                </Button>
            </div>
        </div>
    );
  }

  if (error || !context) {
    return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none text-left overflow-hidden">
            <CardHeader className="text-center bg-muted/20 pb-8">
                <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 shadow-sm border">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <CardTitle className="font-headline text-xl">Verification Failed</CardTitle>
                <CardDescription className="text-sm font-medium px-4">
                    {error || `We couldn't find an active tenancy linked to ${user?.email}. Please verify with your landlord that your portal email is correct.`}
                </CardDescription>
            </CardHeader>
            <CardFooter className="pt-6 flex flex-col gap-3 bg-background border-t">
                <Button className="w-full font-bold h-11 shadow-lg uppercase tracking-widest text-xs" asChild>
                    <Link href="/dashboard">Return to Dashboard</Link>
                </Button>
                <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground" onClick={performDiscovery}>
                    <RefreshCw className="mr-2 h-3 w-3" /> Retry Verification
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">
            Tenant Dashboard
          </h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <Home className="h-4 w-4 text-primary/40" />
              {context.propertyData?.address?.street}, {context.propertyData?.address?.city}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="h-8 text-[9px] font-bold uppercase tracking-widest border-primary/20 text-primary shadow-sm bg-background rounded-xl px-4">
                <Link href="/dashboard"><UserCircle className="mr-2 h-3.5 w-3.5" /> Landlord Mode</Link>
            </Button>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 px-3 font-bold uppercase tracking-widest text-[9px] shadow-sm rounded-xl">
                Secure Portal Active
            </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5 text-primary" /> Rent Schedule
                </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-3xl font-bold">£{context.tenantData.monthlyRent?.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-semibold">
                    Due on the {context.tenantData.rentDueDay || '1st'} of each month
                </p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Tenancy Period
                </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-xl font-bold">Active Agreement</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Verified secure tenancy</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" /> Secure Messenger
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
                <p className="text-xs font-medium leading-relaxed">Communicate directly with your landlord regarding repairs or contract questions.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md rounded-xl uppercase tracking-widest text-[10px]" asChild>
                    <Link href="/tenant/messages">Open Inbox <ChevronRight className="ml-1 h-3 w-3"/></Link>
                </Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b group-hover:bg-muted/50 transition-colors px-6">
                <CardTitle className="text-lg flex items-center gap-2 font-headline"><Wrench className="h-5 w-5 text-primary" /> Repair Center</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Found an issue?</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Report maintenance with photos</p>
                        </div>
                        <Button size="sm" className="h-10 font-bold px-8 shadow-md rounded-xl uppercase tracking-widest text-[9px] bg-primary hover:bg-primary/90" asChild><Link href="/tenant/maintenance">Log Issue</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b group-hover:bg-muted/50 transition-colors px-6">
                <CardTitle className="text-lg flex items-center gap-2 font-headline"><FileText className="h-5 w-5 text-primary" /> Legal Documents</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Compliance Records</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Access safety certs and agreements</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 shadow-sm rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/documents">Browse Vault</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}