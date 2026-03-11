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
  Sparkles,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { collectionGroup, query, where, limit, onSnapshot, doc } from 'firebase/firestore';
import { format } from 'date-fns';

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
    setIsIndexBuilding(false);
    
    const userEmail = user.email.toLowerCase().trim();

    // Secure Handshake: Match normalized email in global tenant registry
    // Security Optimization: forced limit and specific email match for index-provable handshake
    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', userEmail),
        limit(5) 
    );

    let propUnsub: (() => void) | null = null;

    const unsub = onSnapshot(q, (snap) => {
        if (propUnsub) propUnsub();

        const activeTenantDoc = snap.docs.find(d => d.data().status === 'Active');

        if (activeTenantDoc) {
            const data = activeTenantDoc.data();
            const path = activeTenantDoc.ref.path;
            
            // Robust Path Parsing: userProfiles/{landlordId}/properties/{propertyId}/tenants/{tenantId}
            const segments = path.split('/');
            const userProfilesIdx = segments.indexOf('userProfiles');
            const propertiesIdx = segments.indexOf('properties');

            if (userProfilesIdx !== -1 && propertiesIdx !== -1) {
                const landlordId = segments[userProfilesIdx + 1];
                const propertyId = segments[propertiesIdx + 1];
                const tenantId = activeTenantDoc.id;

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
                        setError("Property records could not be resolved.");
                    }
                    setIsLoading(false);
                    setIsIndexBuilding(false);
                }, (err) => {
                    console.warn("Property access restricted:", err.message);
                    setError("Database synchronization required.");
                    setIsLoading(false);
                });
            } else {
                setError("Tenancy mapping invalid.");
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
            setContext(null);
        }
    }, (err) => {
        const msg = err.message.toLowerCase();
        if (msg.includes('index') || err.code === 'failed-precondition') {
            setIsIndexBuilding(true);
        } else {
            console.warn("Discovery handshake failed:", err.message);
            setError("Handshake interrupted. Please refresh.");
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
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Syncing Resident Hub...</p>
        </div>
    );
  }

  if (isIndexBuilding) {
    return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 animate-in fade-in duration-700 px-6">
            <div className="bg-primary/10 p-8 rounded-full w-fit mx-auto border shadow-inner">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-primary">Identity Synchronization</h2>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                    The platform is currently mapping your resident identity. Access will be restored automatically once the cloud database synchronizes your records.
                </p>
            </div>
            <Button variant="outline" className="font-bold h-11 px-10 rounded-xl uppercase tracking-widest text-[10px] w-full" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Check Status
            </Button>
        </div>
    );
  }

  if (error || !context) {
    return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none text-left overflow-hidden">
            <CardHeader className="text-center bg-muted/20 pb-8 px-6">
                <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 shadow-sm border">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <CardTitle className="font-headline text-xl">Tenancy Not Resolved</CardTitle>
                <CardDescription className="text-sm font-medium text-center">
                    {error || `We could not find an active tenancy for ${user?.email}.`}
                </CardDescription>
            </CardHeader>
            <CardFooter className="pt-6 flex flex-col gap-3 bg-background border-t">
                <Button className="w-full font-bold h-11 shadow-lg uppercase tracking-widest text-xs" asChild><Link href="/dashboard">Back to Home</Link></Button>
                <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground" onClick={performDiscovery}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry Sync</Button>
            </CardFooter>
        </Card>
    );
  }

  const propertyAddress = [context.propertyData?.address?.street, context.propertyData?.address?.city].filter(Boolean).join(', ');

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Resident Hub</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1"><Home className="h-4 w-4 text-primary/40" />{propertyAddress}</p>
        </div>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 px-3 font-bold uppercase tracking-widest text-[9px] shadow-sm rounded-xl"><ShieldCheck className="mr-1 h-3 w-3" /> Verified Resident</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-primary" /> Monthly Rent</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-3xl font-bold">£{context.tenantData.monthlyRent?.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-semibold">Payable on the {context.tenantData.rentDueDay || '1st'}</p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" /> Tenancy Start</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-xl font-bold">{context.tenantData.tenancyStartDate?.seconds ? format(new Date(context.tenantData.tenancyStartDate.seconds * 1000), 'dd MMM yyyy') : 'Active Agreement'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Handshake secured</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> Direct Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
                <p className="text-xs font-medium leading-relaxed">Secure direct channel for repairs and tenancy queries.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md rounded-xl uppercase tracking-widest text-[10px]" asChild><Link href="/tenant/messages">Open Inbox <ChevronRight className="ml-1 h-3 w-3"/></Link></Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6"><CardTitle className="text-lg flex items-center gap-2 font-headline"><Wrench className="h-5 w-5 text-primary" /> Repair Center</CardTitle></CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Report a property issue</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Logged repairs appear in audit trail</p>
                    </div>
                    <Button size="sm" className="h-10 font-bold px-8 shadow-md rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/maintenance">Report Repair</Link></Button>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6"><CardTitle className="text-lg flex items-center gap-2 font-headline"><FileText className="h-5 w-5 text-primary" /> Documents</CardTitle></CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Safe & Compliant</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Access shared certificates</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/documents">View Folder</Link></Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}