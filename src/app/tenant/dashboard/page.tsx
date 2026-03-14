
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  ShieldCheck,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, limit, getDocs, doc, updateDoc, getDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';

/**
 * @fileOverview Resident Hub Dashboard
 * Definitively handles the secure identity handshake and context resolution for verified residents.
 */

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
  const [activeRepairs, setActiveRepairs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRepairs, setIsLoadingRepairs] = useState(false);
  const [isHandshaking, setIsHandshaking] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const discoveryRef = useRef(false);

  const performDiscovery = useCallback(async () => {
    if (!user || !firestore || !user.email || discoveryRef.current) {
        if (!user && !isUserLoading) setIsLoading(false);
        return;
    }

    discoveryRef.current = true;
    setIsLoading(true);
    setErrorState(null);

    const userEmail = user.email.toLowerCase().trim();

    try {
        // STAGE 1: Fast UID Discovery
        const tenantsCol = collection(firestore, 'tenants');
        const qByUid = query(tenantsCol, where('userId', '==', user.uid), limit(1));
        const uidSnap = await getDocs(qByUid);

        let tenantDoc = uidSnap.empty ? null : uidSnap.docs[0];

        // STAGE 2: Email Discovery (Handshake path)
        if (!tenantDoc) {
            const qByEmail = query(tenantsCol, where('email', '==', userEmail), limit(1));
            const emailSnap = await getDocs(qByEmail);
            if (!emailSnap.empty) {
                tenantDoc = emailSnap.docs[0];
            }
        }

        if (!tenantDoc) {
            setIsLoading(false);
            discoveryRef.current = false;
            return;
        }

        const tenantData = tenantDoc.data();
        
        // STAGE 3: Secure Identity Handshake
        // Establish permanent UID mapping if only email verified.
        if (tenantData.userId !== user.uid || !tenantData.verified) {
            setIsHandshaking(true);
            try {
                // 1. Map account UID to registry record
                await updateDoc(tenantDoc.ref, { 
                    userId: user.uid,
                    verified: true,
                    joinedDate: new Date().toISOString(),
                    status: 'Active',
                    lastSyncCheck: new Date().toISOString()
                });
                
                // 2. Map account UID to asset record
                const propertyRef = doc(firestore, 'properties', tenantData.propertyId);
                await updateDoc(propertyRef, { 
                    tenantId: user.uid,
                    activeTenantUids: arrayUnion(user.uid),
                    status: 'Occupied'
                });
            } catch (syncErr: any) {
                console.warn("Portal sync partial failure:", syncErr.message);
            }
            setIsHandshaking(false);
        }

        // STAGE 4: Property Resolution
        const propRef = doc(firestore, 'properties', tenantData.propertyId);
        const propSnap = await getDoc(propRef);
        
        if (propSnap.exists()) {
            setContext({
                landlordId: tenantData.landlordId,
                propertyId: tenantData.propertyId,
                tenantId: tenantDoc.id,
                tenantData: { ...tenantDoc.data(), verified: true, userId: user.uid },
                propertyData: propSnap.data()
            });
        } else {
            setErrorState("Identity linked, but asset profile resolution failed.");
        }
        
        setIsLoading(false);
        discoveryRef.current = false;
    } catch (err: any) {
        console.error("Portal sync error:", err);
        setErrorState(err.code === 'permission-denied' 
            ? "Access denied by registry. Please verify your email with your landlord." 
            : `Handshake error: ${err.message}`
        );
        setIsLoading(false);
        discoveryRef.current = false;
    }
  }, [firestore, user, isUserLoading]);

  // Real-time Repair Tracker
  useEffect(() => {
    if (!context || !firestore) return;
    
    setIsLoadingRepairs(true);
    const q = query(
        collection(firestore, 'repairs'),
        where('propertyId', '==', context.propertyId),
        where('status', 'in', ['Open', 'In Progress']),
        limit(5)
    );

    const unsub = onSnapshot(q, (snap) => {
        setActiveRepairs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setIsLoadingRepairs(false);
    });

    return () => unsub();
  }, [context, firestore]);

  useEffect(() => {
    if (!isUserLoading && user && !context) {
        performDiscovery();
    }
  }, [isUserLoading, user, context, performDiscovery]);

  if (isUserLoading || (isLoading && !context) || isHandshaking) {
    return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 px-6">
            <div className="bg-primary/10 p-10 rounded-full w-fit mx-auto relative">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
            </div>
            <div className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-primary tracking-tight">
                    {isHandshaking ? "Securing Handshake..." : "Syncing Portal..."}
                </h2>
                <p className="text-muted-foreground font-medium text-center italic">Establishing verified property connection.</p>
            </div>
        </div>
    );
  }

  if (errorState) {
      return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none overflow-hidden text-left">
            <CardHeader className="bg-destructive/10 pb-6 border-b border-destructive/20">
                <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <CardTitle className="font-headline text-lg text-destructive">Sync Interrupted</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                <p className="text-sm font-medium leading-relaxed text-muted-foreground text-center">{errorState}</p>
            </CardContent>
            <CardFooter className="pt-6 bg-muted/5 border-t">
                <Button variant="outline" className="w-full h-11 font-bold" onClick={() => { discoveryRef.current = false; performDiscovery(); }}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Force Retry Discovery
                </Button>
            </CardFooter>
        </Card>
      );
  }

  if (!context) {
    return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none overflow-hidden text-left">
            <CardHeader className="text-center bg-muted/20 pb-8 border-b">
                <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 border shadow-sm text-muted-foreground/20">
                    <Search className="h-10 w-10" />
                </div>
                <CardTitle className="font-headline text-xl text-primary">Tenancy Not Found</CardTitle>
                <CardDescription className="text-sm font-medium px-4">
                    <strong>{user?.email}</strong> is not currently mapped to an active registry entry.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-muted-foreground text-center">
                <p className="leading-relaxed italic">"Please ask your landlord to verify your registered email in their RentSafeUK portal."</p>
            </CardContent>
            <CardFooter className="pt-6 bg-muted/5 border-t">
                <Button variant="outline" className="w-full h-11 font-bold" onClick={() => { discoveryRef.current = false; performDiscovery(); }}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry Sync
                </Button>
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
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 px-3 font-bold uppercase tracking-widest text-[9px] shadow-sm rounded-xl shrink-0">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Verified Resident
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5 text-primary" /> 
                    Monthly Rent
                </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-3xl font-bold text-foreground">£{context.tenantData.monthlyRent?.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-semibold">Due on day {context.tenantData.rentDueDay || '1'}</p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> 
                    Tenancy Status
                </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-xl font-bold text-foreground">
                    {context.tenantData.tenancyStartDate?.seconds 
                        ? format(new Date(context.tenantData.tenancyStartDate.seconds * 1000), 'dd MMM yyyy') 
                        : 'Verified Active'}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Handshake Valid</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2 text-primary-foreground">
                    <MessageSquare className="h-3.5 w-3.5" /> 
                    Direct Support
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
                <p className="text-xs font-medium">Message your landlord securely about property issues.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md rounded-xl uppercase tracking-widest text-[10px]" asChild>
                    <Link href="/tenant/messages">Open Inbox <ChevronRight className="ml-1 h-3 w-3"/></Link>
                </Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <div className="space-y-6">
            <Card className="border-none shadow-md overflow-hidden group text-left">
                <CardHeader className="bg-muted/30 border-b px-6">
                    <CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground">
                        <Wrench className="h-5 w-5 text-primary" /> 
                        Report Maintenance
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 px-6 pb-6">
                    <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                        <div className="space-y-1 text-left">
                            <p className="text-sm font-bold">Log New Issue</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Submit photos and details</p>
                        </div>
                        <Button size="sm" className="h-10 font-bold px-8 shadow-md rounded-xl uppercase tracking-widest text-[9px]" asChild>
                            <Link href="/tenant/maintenance">Record Request</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-md overflow-hidden text-left">
                <CardHeader className="bg-muted/30 border-b px-6">
                    <CardTitle className="text-sm font-bold flex items-center justify-between">
                        Active Repair Tracking
                        <Wrench className="h-4 w-4 text-primary opacity-20" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoadingRepairs ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary/20" /></div>
                    ) : activeRepairs.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground italic">No active maintenance requests.</div>
                    ) : (
                        <div className="divide-y">
                            {activeRepairs.map((r) => (
                                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                                    <div className="min-w-0 text-left">
                                        <p className="font-bold text-sm truncate">{r.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant={r.status === 'In Progress' ? 'default' : 'secondary'} className="text-[8px] uppercase font-bold px-1.5 h-4">
                                                {r.status}
                                            </Badge>
                                            <span className="text-[9px] text-muted-foreground font-medium">
                                                {r.reportedDate ? format(new Date(r.reportedDate), 'd MMM') : 'Recently'}
                                            </span>
                                        </div>
                                    </div>
                                    {r.status === 'In Progress' ? <Clock className="h-4 w-4 text-primary animate-pulse" /> : <CheckCircle2 className="h-4 w-4 text-green-500 opacity-40" />}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <Card className="border-none shadow-md overflow-hidden group text-left self-start">
            <CardHeader className="bg-muted/30 border-b px-6">
                <CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground">
                    <FileText className="h-5 w-5 text-primary" /> 
                    Property Records
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1 text-left">
                        <p className="text-sm font-bold">Shared Documents</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">View contracts and certificates</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 rounded-xl uppercase tracking-widest text-[9px]" asChild>
                        <Link href="/tenant/documents">Access Vault</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
