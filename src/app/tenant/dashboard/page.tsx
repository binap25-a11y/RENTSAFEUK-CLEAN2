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
import { collection, query, where, limit, getDocs, doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
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
  const discoveryRef = useRef(false);

  const performDiscovery = useCallback(async () => {
    if (!user || !firestore || !user.email || discoveryRef.current) return;
    discoveryRef.current = true;
    setIsLoading(true);

    const userEmail = user.email.toLowerCase().trim();

    try {
        const tenantsCol = collection(firestore, 'tenants');
        
        // STAGE 1: Identity Link Search (By UID)
        const qByUid = query(tenantsCol, where('userId', '==', user.uid), limit(1));
        let snap = await getDocs(qByUid);

        // STAGE 2: Registry Bridge Fallback (By Email)
        if (snap.empty) {
            // Note: Rules are optimized for this search
            const qByEmail = query(tenantsCol, where('email', '==', userEmail), limit(1));
            snap = await getDocs(qByEmail);
        }

        if (snap.empty) {
            console.warn("Resident Hub: No verified tenancy found for:", userEmail);
            setIsLoading(false);
            discoveryRef.current = false;
            return;
        }

        const tenantDoc = snap.docs[0];
        const tenantData = tenantDoc.data();
        
        // STAGE 3: Secure Identity Handshake
        // Establish permanent UID link on first visit to transition to high-speed authorization
        if (!tenantData.userId || tenantData.userId !== user.uid || !tenantData.verified) {
            setIsHandshaking(true);
            
            // 1. Update Tenant registry with account UID
            await updateDoc(tenantDoc.ref, { 
                userId: user.uid,
                verified: true,
                joinedDate: new Date().toISOString(),
                status: 'Active' 
            });
            
            // 2. Update Property registry with UID handshake
            const propertyRef = doc(firestore, 'properties', tenantData.propertyId);
            await updateDoc(propertyRef, { 
                tenantId: user.uid,
                activeTenantUids: arrayUnion(user.uid)
            });

            toast({ title: "Portal Connected", description: "Identity registry synchronized." });
            setIsHandshaking(false);
        }

        // STAGE 4: Context Resolution
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
        }
        
        setIsLoading(false);
        discoveryRef.current = false;
    } catch (err: any) {
        console.error("Resident Hub Discovery Error:", err.message);
        
        // Emit rich error for developer oversight if discovery is blocked by rules
        if (err.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'tenants',
                operation: 'list'
            }));
        }
        
        setIsLoading(false);
        discoveryRef.current = false;
    }
  }, [user, firestore]);

  useEffect(() => {
    if (!isUserLoading && user && !context) {
        performDiscovery();
    }
  }, [isUserLoading, user, context, performDiscovery]);

  if (isUserLoading || (isLoading && !context) || isHandshaking) {
    return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 px-6">
            <div className="relative">
                <div className="bg-primary/10 p-10 rounded-full w-fit mx-auto relative z-10">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/5 rounded-full animate-ping" />
            </div>
            <div className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-primary tracking-tight">Syncing Resident Hub...</h2>
                <p className="text-muted-foreground font-medium">Establishing secure connection to your property vault.</p>
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
                <CardTitle className="font-headline text-xl text-primary">Tenancy Not Linked</CardTitle>
                <CardDescription className="text-sm font-medium px-4">
                    The account <strong>{user?.email}</strong> is not currently mapped to an active tenancy in our registry.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-muted-foreground">
                <p className="text-center leading-relaxed italic">"Please ask your landlord to verify that they have registered your account email correctly in the management portal."</p>
            </CardContent>
            <CardFooter className="pt-6 bg-muted/5 border-t">
                <Button variant="outline" className="w-full h-11 font-bold" onClick={() => { discoveryRef.current = false; performDiscovery(); }}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry Identity Sync
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
                <p className="text-xs text-muted-foreground mt-1 font-semibold">Due on day {context.tenantData.rentDueDay || '1'} of the month</p>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none hover:bg-muted/5 transition-all text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> 
                    Agreement Start
                </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
                <div className="text-xl font-bold text-foreground">
                    {context.tenantData.tenancyStartDate?.seconds 
                        ? format(new Date(context.tenantData.tenancyStartDate.seconds * 1000), 'dd MMM yyyy') 
                        : 'Active Lease'}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-medium italic">Handshake Verified</p>
            </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-primary text-primary-foreground text-left">
            <CardHeader className="pb-2 px-6">
                <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 flex items-center gap-2 text-primary-foreground">
                    <MessageSquare className="h-3.5 w-3.5" /> 
                    Resident Support
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
                <p className="text-xs font-medium">Securely message your landlord about any property issues.</p>
                <Button variant="secondary" size="sm" className="w-full font-bold h-9 shadow-md rounded-xl uppercase tracking-widest text-[10px]" asChild>
                    <Link href="/tenant/messages">Open Inbox <ChevronRight className="ml-1 h-3 w-3"/></Link>
                </Button>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mt-8">
        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6 text-left">
                <CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground">
                    <Wrench className="h-5 w-5 text-primary" /> 
                    Request Repairs
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Log New Issue</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Submit photos and details</p>
                    </div>
                    <Button size="sm" className="h-10 font-bold px-8 shadow-md rounded-xl uppercase tracking-widest text-[9px]" asChild>
                        <Link href="/tenant/maintenance">Submit Fix</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md overflow-hidden group text-left">
            <CardHeader className="bg-muted/30 border-b px-6 text-left">
                <CardTitle className="text-lg flex items-center gap-2 font-headline text-foreground">
                    <FileText className="h-5 w-5 text-primary" /> 
                    Property Vault
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 px-6 pb-6">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-transparent group-hover:border-primary/10 transition-all">
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Shared Documents</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">EPC, Certificates & Contracts</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-10 font-bold px-8 border-primary/20 hover:bg-primary/5 rounded-xl uppercase tracking-widest text-[9px]" asChild>
                        <Link href="/tenant/documents">View Folder</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}