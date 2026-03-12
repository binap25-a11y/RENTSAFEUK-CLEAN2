
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
  ShieldCheck,
  Search,
  CheckCircle2
} from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { collectionGroup, query, where, limit, onSnapshot, doc, updateDoc, or } from 'firebase/firestore';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

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
  const router = useRouter();
  const [context, setContext] = useState<TenantContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHandshaking, setIsHandshaking] = useState(false);

  const performDiscovery = useCallback(() => {
    if (!user || !firestore || !user.email) {
      setIsLoading(false);
      return () => {};
    }

    setIsLoading(true);
    setError(null);
    setIsIndexBuilding(false);
    
    const userEmail = user.email.toLowerCase().trim();

    // 1. Robust Discovery Handshake via Collection Group
    // We search by email OR by previously linked userId for maximum speed
    const q = query(
        collectionGroup(firestore, 'tenants'), 
        or(
            where('email', '==', userEmail),
            where('userId', '==', user.uid)
        ),
        limit(1) 
    );

    let propUnsub: (() => void) | null = null;

    const unsub = onSnapshot(q, (snap) => {
        if (propUnsub) propUnsub();

        if (snap.empty) {
            setIsLoading(false);
            setContext(null);
            return;
        }

        const activeTenantDoc = snap.docs[0];
        const data = activeTenantDoc.data();
        const path = activeTenantDoc.ref.path;
        
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
                    
                    // HANDSHAKE TRIGGER: Update record if identity linking is incomplete
                    if (data.verified !== true || data.userId !== user.uid) {
                        setIsHandshaking(true);
                        updateDoc(activeTenantDoc.ref, { 
                            joinedDate: new Date().toISOString(),
                            userId: user.uid,
                            verified: true
                        }).then(() => {
                            setIsHandshaking(false);
                        }).catch(err => {
                            console.warn("Handshake write pending index:", err.message);
                            setIsHandshaking(false);
                        });
                    }

                    setError(null);
                } else {
                    setError("Identity linked but property profile is currently inaccessible.");
                }
                setIsLoading(false);
                setIsIndexBuilding(false);
            }, (err) => {
                setError("Property synchronization pending. Landlord access verification required.");
                setIsLoading(false);
            });
        } else {
            setError("Tenancy record is incompatible with portal discovery.");
            setIsLoading(false);
        }
    }, (err) => {
        const msg = err.message.toLowerCase();
        if (msg.includes('index') || err.code === 'failed-precondition') {
            setIsIndexBuilding(true);
        } else {
            console.error("Discovery error:", err);
            setError("Cloud identity handshake failed.");
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
        <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4 bg-background">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse text-center">
                Resolving Resident Identity...
            </p>
        </div>
    );
  }

  if (isIndexBuilding) {
    return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 px-6 animate-in fade-in duration-700">
            <div className="bg-primary/10 p-8 rounded-full w-fit mx-auto border shadow-inner">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-primary">Portal Setup in Progress</h2>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                    The platform is currently initializing high-speed identity discovery.
                </p>
                <div className="p-4 rounded-xl bg-muted/50 border border-dashed text-xs text-muted-foreground mt-4 text-left">
                    <p className="font-bold uppercase text-[9px] tracking-widest mb-1 text-primary">Status: Building Discovery Index</p>
                    <p>This is a one-time cloud task that typically takes 2-3 minutes. Access will grant automatically upon completion.</p>
                </div>
            </div>
            <Button variant="outline" className="font-bold h-11 px-10 rounded-xl uppercase tracking-widest text-[10px] w-full shadow-sm" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Check Status
            </Button>
        </div>
    );
  }

  if (error || !context) {
    return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none text-left overflow-hidden">
            <CardHeader className="text-center bg-muted/20 pb-8 px-6 border-b">
                <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 shadow-sm border">
                    <Search className="h-10 w-10 text-primary/40" />
                </div>
                <CardTitle className="font-headline text-xl text-primary">Tenancy Not Found</CardTitle>
                <CardDescription className="text-sm font-medium text-center px-4">
                    We could not locate an active record matching <strong>{user?.email}</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Helpful Tips</p>
                    <ul className="text-xs text-muted-foreground space-y-2">
                        <li className="flex items-start gap-2"><div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" /> Verify with your landlord that <strong>{user?.email}</strong> is recorded correctly.</li>
                        <li className="flex items-start gap-2"><div className="h-1 w-1 rounded-full bg-primary mt-1.5 shrink-0" /> Ensure your landlord has set your tenancy status to 'Active'.</li>
                    </ul>
                </div>
            </CardContent>
            <CardFooter className="pt-6 flex flex-col gap-3 bg-muted/5 border-t">
                <Button className="w-full font-bold h-11 shadow-lg uppercase tracking-widest text-xs" onClick={() => router.push('/dashboard')}>Go to Main Dashboard</Button>
                <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground" onClick={performDiscovery}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Re-trigger Handshake
                </Button>
            </CardFooter>
        </Card>
    );
  }

  const propertyAddress = [context.propertyData?.address?.street, context.propertyData?.address?.city].filter(Boolean).join(', ');
  const isVerified = context.tenantData.verified === true;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Resident Hub</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1"><Home className="h-4 w-4 text-primary/40" />{propertyAddress}</p>
        </div>
        <div className="flex items-center gap-2">
            {isHandshaking ? (
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-primary animate-pulse px-2 bg-primary/5 py-1 rounded-lg border border-primary/10">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Linking Identity...
                </div>
            ) : isVerified ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 px-3 font-bold uppercase tracking-widest text-[9px] shadow-sm rounded-xl shrink-0">
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Verified Resident
                </Badge>
            ) : (
                <Badge variant="secondary" className="h-8 px-3 font-bold uppercase tracking-widest text-[9px] rounded-xl shrink-0 opacity-50">
                    Handshake Processing
                </Badge>
            )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-primary" /> Monthly Rent</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-3xl font-bold text-foreground">£{context.tenantData.monthlyRent?.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-semibold">Due on the {context.tenantData.rentDueDay || '1st'} of the month</p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" /> Agreement Date</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-xl font-bold text-foreground">{context.tenantData.tenancyStartDate?.seconds ? format(new Date(context.tenantData.tenancyStartDate.seconds * 1000), 'dd MMM yyyy') : 'Rolling Periodic'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Active Tenancy Registry</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground transition-all hover:translate-y-[-2px] text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2 text-primary-foreground"><MessageSquare className="h-3.5 w-3.5" /> Communications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
                <p className="text-xs font-medium leading-relaxed">Secure channel for repairs and tenancy management queries.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md rounded-xl uppercase tracking-widest text-[10px]" asChild><Link href="/tenant/messages">Inbox <ChevronRight className="ml-1 h-3 w-3"/></Link></Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6"><CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground"><Wrench className="h-5 w-5 text-primary" /> Repair Center</CardTitle></CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Report a property issue</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Logged repairs appear in audit trail</p>
                    </div>
                    <Button size="sm" className="h-10 font-bold px-8 shadow-md rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/maintenance">Log Issue</Link></Button>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6"><CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground"><FileText className="h-5 w-5 text-primary" /> Documents</CardTitle></CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Shared Portfolio Docs</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Safety certificates & agreements</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/documents">Open Vault</Link></Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
