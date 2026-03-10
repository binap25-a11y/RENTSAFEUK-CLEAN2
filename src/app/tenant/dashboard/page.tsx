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
  ChevronRight,
  UserCircle,
  ShieldCheck,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
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

  useEffect(() => {
    if (isUserLoading) return;
    
    if (!user || !firestore || !user.email) {
      setIsLoading(false);
      return;
    }

    let propUnsub: (() => void) | null = null;
    const userEmail = user.email.toLowerCase().trim();

    // Discovery query to find if this email exists in any tenant collection across the platform
    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', userEmail),
        limit(5)
    );

    const unsub = onSnapshot(q, (snap) => {
        if (propUnsub) propUnsub();

        const activeTenantDoc = snap.docs.find(d => d.data().status === 'Active');

        if (activeTenantDoc) {
            const data = activeTenantDoc.data();
            const pathSegments = activeTenantDoc.ref.path.split('/');
            
            // Robust segment matching for tenant hierarchy
            const landlordIdx = pathSegments.indexOf('userProfiles');
            const propertyIdx = pathSegments.indexOf('properties');
            
            if (landlordIdx !== -1 && propertyIdx !== -1) {
                const landlordId = pathSegments[landlordIdx + 1];
                const propertyId = pathSegments[propertyIdx + 1];
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
                    }
                    setIsLoading(false);
                    setIsIndexBuilding(false);
                }, (error) => {
                    console.warn("Property context fetch restricted (check rules):", error.message);
                    setIsLoading(false);
                    setIsIndexBuilding(false);
                });
            } else {
                setIsLoading(false);
                setIsIndexBuilding(false);
            }
        } else {
            setIsLoading(false);
            setIsIndexBuilding(false);
        }
    }, (error) => {
        const msg = error.message.toLowerCase();
        if (msg.includes('index') || error.code === 'failed-precondition') {
            setIsIndexBuilding(true);
        } else {
            console.warn("Tenant portal discovery issue:", error.message);
            setIsIndexBuilding(false);
        }
        setIsLoading(false);
    });

    return () => {
        unsub();
        if (propUnsub) propUnsub();
    };
  }, [user, isUserLoading, firestore]);

  if (isLoading || isUserLoading) {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Authenticating Tenant Portal...</p>
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
                <h2 className="font-headline text-2xl font-bold text-primary">Setting Up Your Tenancy</h2>
                <p className="text-muted-foreground font-medium leading-relaxed">
                    Our cloud system is synchronizing your tenant records for the first time. This high-speed indexing ensures your data remains private and secure.
                </p>
            </div>
            <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-primary/60 uppercase tracking-widest">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Live Sync Active
                </div>
                <Button variant="outline" className="font-bold h-11 px-10 rounded-xl border-primary/20 hover:bg-primary/5 uppercase tracking-widest text-[10px]" onClick={() => window.location.reload()}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh Portal
                </Button>
            </div>
        </div>
    );
  }

  if (!context) {
    return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none text-left">
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
            <CardFooter className="pt-6 flex flex-col gap-3">
                <Button className="w-full font-bold h-11 shadow-lg uppercase tracking-widest text-xs" asChild>
                    <Link href="/dashboard">Return to Main Dashboard</Link>
                </Button>
                <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground" onClick={() => window.location.reload()}>
                    Refresh Session
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
              Welcome home, {user?.displayName?.split(' ')[0] || 'Tenant'} — {context.propertyData?.address?.street}, {context.propertyData?.address?.city}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="h-8 text-[9px] font-bold uppercase tracking-widest border-primary/20 text-primary shadow-sm bg-background rounded-xl px-4">
                <Link href="/dashboard"><UserCircle className="mr-2 h-3.5 w-3.5" /> Landlord Mode</Link>
            </Button>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 px-3 font-bold uppercase tracking-widest text-[9px] shadow-sm rounded-xl">
                Tenant Portal Active
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
                <div className="text-xl font-bold">Rolling Contract</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Managed via RentSafeUK Secure Portal</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" /> Direct Contact
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
                <p className="text-xs font-medium leading-relaxed">Communicate securely with your landlord regarding your tenancy.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md rounded-xl uppercase tracking-widest text-[10px]" asChild>
                    <Link href="/tenant/messages">Open Secure Messenger <ChevronRight className="ml-1 h-3 w-3"/></Link>
                </Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b group-hover:bg-muted/50 transition-colors px-6">
                <CardTitle className="text-lg flex items-center gap-2 font-headline"><Wrench className="h-5 w-5 text-primary" /> Maintenance Hub</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Found an issue?</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Report repairs with photos instantly</p>
                        </div>
                        <Button size="sm" className="h-10 font-bold px-8 shadow-md rounded-xl uppercase tracking-widest text-[9px] bg-primary hover:bg-primary/90" asChild><Link href="/tenant/maintenance">Log Issue</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b group-hover:bg-muted/50 transition-colors px-6">
                <CardTitle className="text-lg flex items-center gap-2 font-headline"><FileText className="h-5 w-5 text-primary" /> Tenancy Documents</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                        <div className="space-y-1">
                            <p className="text-sm font-bold">Legal Compliance</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Access safety certs and agreements</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 shadow-sm rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/documents">Browse Files</Link></Button>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}