'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, collectionGroup, limit, doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Home, 
  Loader2, 
  Search, 
  LayoutGrid, 
  List, 
  Eye, 
  Bed, 
  Bath, 
  Sparkles,
  ChevronRight,
  UserCircle,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
  propertyType: string;
  status: string;
  bedrooms: number;
  bathrooms: number;
  imageUrl?: string;
  userId: string;
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [discoveryComplete, setDiscoveryComplete] = useState(false);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [handshakeTimedOut, setHandshakeTimedOut] = useState(false);

  // 1. Unified Profile & Role Discovery
  useEffect(() => {
    if (isUserLoading || !user || !firestore) return;

    const userProfileRef = doc(firestore, 'userProfiles', user.uid);
    const unsubProfile = onSnapshot(userProfileRef, (snap) => {
      const data = snap.data();
      const role = data?.role || 'landlord';
      setUserRole(role);
      setIsLoadingProfile(false);
    }, (err) => {
      console.error("Profile sync failed:", err);
      setIsLoadingProfile(false);
    });

    return () => unsubProfile();
  }, [user, isUserLoading, firestore]);

  // 2. Parallel Data Handshake & Redirection
  useEffect(() => {
    if (isLoadingProfile || !user || !firestore || !userRole) return;

    const userEmail = user.email?.toLowerCase().trim();

    // A. Landlord Discovery (Always happens in parallel)
    const propQuery = query(
      collection(firestore, 'userProfiles', user.uid, 'properties'), 
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );

    const unsubProps = onSnapshot(propQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
      setProperties(list);
      
      // If user has properties, they are definitely a landlord/agent context
      if (list.length > 0 || userRole === 'landlord' || userRole === 'agent') {
        setDiscoveryComplete(true);
      }
    });

    // B. Tenant Global Discovery (Only if role is tenant or unknown)
    let unsubTenants = () => {};
    if (userEmail) {
        const tenantsQuery = query(
            collectionGroup(firestore, 'tenants'),
            where('email', '==', userEmail),
            limit(1)
        );

        unsubTenants = onSnapshot(tenantsQuery, (snap) => {
            if (!snap.empty) {
                // Verified tenant found - redirect to hub immediately
                router.replace('/tenant/dashboard');
            } else if (userRole === 'tenant') {
                // Explicitly a tenant but no record found yet
                setDiscoveryComplete(true); 
            }
        }, (err) => {
            const msg = err.message.toLowerCase();
            if (msg.includes('index') || err.code === 'failed-precondition') {
                if (userRole === 'tenant') setIsIndexBuilding(true);
            } else {
                if (userRole === 'tenant') setDiscoveryComplete(true);
            }
        });
    }

    // C. Safety Timeout for Discovery
    const timer = setTimeout(() => {
        setHandshakeTimedOut(true);
    }, 5000);

    return () => {
        unsubProps();
        unsubTenants();
        clearTimeout(timer);
    };
  }, [user, userRole, isLoadingProfile, firestore, router]);

  const filteredProperties = useMemo(() => {
    if (!searchTerm) return properties;
    const term = searchTerm.toLowerCase();
    return properties.filter(p => 
      [p.address.nameOrNumber, p.address.street, p.address.city, p.address.postcode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [properties, searchTerm]);

  // Loading States
  if (isUserLoading || isLoadingProfile) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse text-center">Initializing Portal...</p>
      </div>
    );
  }

  // Interstitial for Index Building or Hanging Handshake
  // Only show this to users who are strictly defined as tenants and discovery is not complete
  if ((isIndexBuilding || !discoveryComplete) && !handshakeTimedOut && userRole === 'tenant') {
    return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 px-6 animate-in fade-in duration-700">
            <div className="bg-primary/10 p-8 rounded-full w-fit mx-auto border shadow-inner">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-primary">Resident Verification</h2>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed text-center">
                    The platform is currently verifying your resident credentials in the cloud.
                </p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 border border-dashed text-xs text-muted-foreground text-left">
                <p className="font-bold uppercase text-[9px] mb-1">Status: Mapping Identity</p>
                {isIndexBuilding 
                    ? "Firestore cloud indexes are being provisioned. This takes 2-3 minutes on first setup." 
                    : "Synchronizing with your landlord's records..."}
            </div>
            <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full h-11 font-bold uppercase text-[10px] tracking-widest" onClick={() => router.refresh()}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Check Status
                </Button>
                <Button variant="ghost" className="w-full text-[9px] font-bold uppercase text-muted-foreground" onClick={() => setDiscoveryComplete(true)}>
                    Bypass to Portfolio Manager
                </Button>
            </div>
        </div>
    );
  }

  // Empty State / New Landlord Onboarding
  if (properties.length === 0 && (userRole === 'landlord' || userRole === 'agent' || !userRole)) {
      return (
          <div className="text-center py-20 animate-in fade-in duration-500">
              <div className="max-w-md mx-auto space-y-6 px-6 text-left">
                  <div className="bg-muted p-6 rounded-full w-fit mx-auto shadow-inner text-muted-foreground/20">
                      <Home className="h-12 w-12" />
                  </div>
                  <h2 className="text-2xl font-bold font-headline text-center">Welcome to RentSafeUK</h2>
                  <p className="text-muted-foreground font-medium text-center">Your profile is active. Onboard your first rental asset to begin managing your estate.</p>
                  <Button asChild size="lg" className="px-10 font-bold shadow-lg h-12 w-full mt-4">
                      <Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Onboard First Asset</Link>
                  </Button>
              </div>
          </div>
      );
  }

  // Main Landlord Dashboard View
  return (
      <div className="space-y-8 animate-in fade-in duration-500 text-left">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Portfolio Manager</h1>
          <p className="text-muted-foreground font-medium text-lg">Central control for your rental estate.</p>
        </div>
        
        <Card className="shadow-lg border-none overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/5">
            <CardTitle className="text-lg font-bold">Estate View</CardTitle>
            <Button asChild size="sm" className="font-bold uppercase tracking-widest text-[10px] h-9 px-4">
              <Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-3.5 w-3.5" /> Add Asset</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="dashboard-filter"
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Filter by address..." 
                  className="pl-8 h-10" 
                />
              </div>
              <div className="flex items-center rounded-md bg-muted p-1">
                <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
                <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
              </div>
            </div>
  
            {view === 'grid' ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProperties.map(p => (
                  <Card key={p.id} className="group overflow-hidden flex flex-col hover:shadow-xl transition-all cursor-pointer border-none shadow-md bg-card" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                    <div className="relative aspect-[16/10] bg-muted overflow-hidden border-b">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="Property" className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                      ) : <div className="flex items-center justify-center w-full h-full bg-primary/5"><Home className="h-12 w-12 text-primary/10" /></div>}
                    </div>
                    <CardHeader className="pb-3 px-4 text-left">
                      <CardTitle className="text-base font-bold truncate">{[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}</CardTitle>
                      <CardDescription className="truncate text-xs">{p.address.city}, {p.address.postcode}</CardDescription>
                    </CardHeader>
                    <CardFooter className="flex justify-between items-center pt-4 px-4 border-t bg-muted/5">
                      <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase">
                        <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms}</span>
                        <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>
                      </div>
                      <Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[9px] uppercase h-5 font-bold">{p.status}</Badge>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase pl-6 text-left">Address</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-left">Type</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-left">Status</TableHead>
                      <TableHead className="text-right font-bold text-[10px] uppercase pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProperties.map(p => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                        <TableCell className="font-bold text-sm pl-6 py-4 text-left">
                          {[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}
                          <div className="text-[11px] text-muted-foreground font-medium">{p.address.city}, {p.address.postcode}</div>
                        </TableCell>
                        <TableCell className="text-[10px] uppercase font-bold text-muted-foreground text-left">{p.propertyType}</TableCell>
                        <TableCell className="text-left"><Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[9px] uppercase font-bold">{p.status}</Badge></TableCell>
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><Eye className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
}
