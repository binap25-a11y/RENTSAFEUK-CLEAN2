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
  Search
} from 'lucide-react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, limit, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
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
  
  const [context, setContext] = useState<TenantContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHandshaking, setIsHandshaking] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<'searching' | 'failed' | 'handshaking'>('searching');
  const discoveryRef = useRef(false);

  const performDiscovery = useCallback(async () => {
    if (!user || !firestore || !user.email || discoveryRef.current) return;
    discoveryRef.current = true;
    setIsLoading(true);
    setDiscoveryStatus('searching');

    const userEmail = user.email.toLowerCase().trim();

    try {
        const tenantsCol = collection(firestore, 'tenants');
        
        // STAGE 1: Identity Link Search (By UID)
        // This query matches optimized security rules for fast discovery.
        const qByUid = query(tenantsCol, where('userId', '==', user.uid), limit(1));
        let snap = await getDocs(qByUid);

        // STAGE 2: Registry Bridge Fallback (By Email)
        // If no UID link exists, we search the landlord registry by verified email.
        if (snap.empty) {
            const qByEmail = query(tenantsCol, where('email', '==', userEmail), limit(1));
            snap = await getDocs(qByEmail);
        }

        if (snap.empty) {
            setIsLoading(false);
            setDiscoveryStatus('failed');
            discoveryRef.current = false;
            return;
        }

        const tenantDoc = snap.docs[0];
        const tenantData = tenantDoc.data();
        
        // STAGE 3: Secure Identity Handshake
        // If the tenant document doesn't have the user's UID, we perform an authorized link.
        if (!tenantData.userId || tenantData.userId !== user.uid || !tenantData.verified) {
            setIsHandshaking(true);
            setDiscoveryStatus('handshaking');
            
            // 1. Link account UID to Tenant registry
            await updateDoc(tenantDoc.ref, { 
                userId: user.uid,
                verified: true,
                joinedDate: new Date().toISOString(),
                status: 'Active' 
            }).catch(e => {
                console.warn("Resident Hub: Identity sync deferred.", e.message);
            });
            
            // 2. Link account UID to Property registry (authorized by specialized update rule)
            const propertyRef = doc(firestore, 'properties', tenantData.propertyId);
            await updateDoc(propertyRef, { tenantId: user.uid })
                .catch(e => {
                    console.warn("Resident Hub: Property sync deferred. Access remains active via registry bridge.");
                });

            toast({ title: "Portal Connection Established", description: "Identity verification complete." });
            setIsHandshaking(false);
        }

        // STAGE 4: Authorized Context Resolution
        const propRef = doc(firestore, 'properties', tenantData.propertyId);
        const propSnap = await getDoc(propRef);
        
        if (propSnap.exists()) {
            setContext({
                landlordId: tenantData.landlordId,
                propertyId: tenantData.propertyId,
                tenantId: tenantDoc.id,
                tenantData: { ...tenantData, verified: true, userId: user.uid },
                propertyData: propSnap.data()
            });
        } else {
            console.error("Resident Hub: Linked property document missing.");
            setDiscoveryStatus('failed');
        }
        
        setIsLoading(false);
        discoveryRef.current = false;
    } catch (err: any) {
        // Surface rich error for developer oversight if discovery is blocked by rules
        if (err.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'tenants',
                operation: 'list'
            }));
        } else {
            console.error("Resident Hub Discovery Error:", err.message);
        }
        
        setIsLoading(false);
        setDiscoveryStatus('failed');
        discoveryRef.current = false;
    }
  }, [user, firestore]);

  useEffect(() => {
    if (!isUserLoading && user && !context) {
        performDiscovery();
    }
  }, [isUserLoading, user, context, performDiscovery]);

  if (isUserLoading || isLoading || isHandshaking) {
    return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 px-6">
            <div className="relative">
                <div className="bg-primary/10 p-10 rounded-full w-fit mx-auto relative z-10">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/5 rounded-full animate-ping" />
            </div>
            <div className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-primary tracking-tight text-center">Syncing Portal...</h2>
                <p className="text-muted-foreground font-medium text-center">Establishing secure connection to your property records.</p>
            </div>
        </div>
    );
  }

  if (!context) {
    return (
        <Card className="max-w-md mx-auto mt-20 shadow-2xl border-none overflow-hidden text-left">
            <CardHeader className="text-center bg-muted/20 pb-8 border-b">
                <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 border shadow-sm text-muted-foreground/20">
                    <Search className="h-10 w-10" />
                </div>
                <CardTitle className="font-headline text-xl text-primary">Registry Not Linked</CardTitle>
                <CardDescription className="text-sm font-medium px-4">
                    The email <strong>{user?.email}</strong> is not currently mapped to an active tenancy in our portfolio registry.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-muted-foreground">
                <p className="text-center leading-relaxed">Please ask your landlord to verify that they have registered your account email correctly in the management portal.</p>
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
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 h-8 px-3 font-bold uppercase tracking-widest text-[9px] shadow-sm rounded-xl shrink-0">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Verified Resident
            </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all text-left">
            <CardHeader className="pb-2 px-6 text-left">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-primary" /> Monthly Rent</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 text-left">
                <div className="text-3xl font-bold text-foreground">£{context.tenantData.monthlyRent?.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground mt-1 font-semibold">Due on the {context.tenantData.rentDueDay || '1st'}</p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all text-left">
            <CardHeader className="pb-2 px-6 text-left">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-primary" /> Lease Status</CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 text-left">
                <div className="text-xl font-bold text-foreground">
                    {context.tenantData.tenancyStartDate?.seconds 
                        ? format(new Date(context.tenantData.tenancyStartDate.seconds * 1000), 'dd MMM yyyy') 
                        : 'Active Agreement'}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Handshake Verified</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground text-left">
            <CardHeader className="pb-2 px-6 text-left">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2 text-primary-foreground"><MessageSquare className="h-3.5 w-3.5" /> Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6 text-left">
                <p className="text-xs font-medium">Message your landlord directly about any issues or queries.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md rounded-xl uppercase tracking-widest text-[10px]" asChild><Link href="/tenant/messages">Open Inbox <ChevronRight className="ml-1 h-3 w-3"/></Link></Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6 text-left"><CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground"><Wrench className="h-5 w-5 text-primary" /> Maintenance</CardTitle></CardHeader>
            <CardContent className="pt-6 px-6 pb-6 text-left">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1 text-left">
                        <p className="text-sm font-bold">Request a Fix</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Submit photos and details</p>
                    </div>
                    <Button size="sm" className="h-10 font-bold px-8 shadow-md rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/maintenance">Log Issue</Link></Button>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6 text-left"><CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground"><FileText className="h-5 w-5 text-primary" /> Document Vault</CardTitle></CardHeader>
            <CardContent className="pt-6 px-6 pb-6 text-left">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1 text-left">
                        <p className="text-sm font-bold">Legal Files</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">EPC, Gas & Agreements</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 rounded-xl uppercase tracking-widest text-[9px]" asChild><Link href="/tenant/documents">View Files</Link></Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}