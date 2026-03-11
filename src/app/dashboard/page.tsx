'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, collectionGroup, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

/**
 * @fileOverview Intelligent High-Performance Traffic Controller.
 * Resolves roles in parallel and routes Tenants to the Resident Hub immediately.
 */

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
  
  // HOOK STACK: Absolute top-level declaration for lifecycle stability
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(true);
  const [isTenant, setIsTenant] = useState<boolean | null>(null);
  const [isLandlord, setIsLandlord] = useState<boolean | null>(null);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Identity Discovery Effect: Parallel Handshake
  useEffect(() => {
    if (isUserLoading || !user || !firestore) return;
    
    const userEmail = user.email?.toLowerCase().trim();

    // 1. LANDLORD DISCOVERY (Fast Path)
    const propQuery = query(
      collection(firestore, 'userProfiles', user.uid, 'properties'), 
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );

    const unsubProps = onSnapshot(propQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
      setProperties(list);
      setIsLoadingProps(false);
      setIsLandlord(snap.size > 0);
    }, (error) => {
      console.warn("Landlord discovery error:", error.message);
      setIsLoadingProps(false);
      setIsLandlord(false);
    });

    // 2. TENANT DISCOVERY (Secure Handshake)
    let unsubTenants = () => {};
    if (userEmail) {
        const tenantsQuery = query(
            collectionGroup(firestore, 'tenants'),
            where('email', '==', userEmail),
            limit(1)
        );

        unsubTenants = onSnapshot(tenantsQuery, (snap) => {
            const activeTenant = snap.docs.find(d => d.data().status === 'Active');
            if (activeTenant) {
                setIsTenant(true);
            } else {
                setIsTenant(false);
            }
            setIsIndexBuilding(false);
        }, (error) => {
            if (error.message.toLowerCase().includes('index') || error.code === 'failed-precondition') {
                setIsIndexBuilding(true);
            } else {
                console.error("Tenant discovery error:", error.message);
                setIsTenant(false);
            }
        });
    } else {
        setIsTenant(false);
    }

    // 3. SAFETY TIMEOUT: Prevent mapping hang
    const timeoutId = setTimeout(() => {
        setHasTimedOut(true);
        // Fallback: If we haven't resolved tenant status, and landlord is clearly false, 
        // we allow the UI to transition to the empty state.
        if (isTenant === null) setIsTenant(false);
    }, 6000);

    return () => {
        unsubProps();
        unsubTenants();
        clearTimeout(timeoutId);
    };
  }, [user, isUserLoading, firestore]);

  // High-Speed Routing for Tenants
  useEffect(() => {
    if (isTenant === true) {
        router.replace('/tenant/dashboard');
    }
  }, [isTenant, router]);

  const filteredProperties = useMemo(() => {
    if (!searchTerm) return properties;
    const term = searchTerm.toLowerCase();
    return properties.filter(p => 
      Object.values(p.address).some(val => typeof val === 'string' && val.toLowerCase().includes(term))
    );
  }, [properties, searchTerm]);

  // UI BRANCHING
  if (isUserLoading) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Securing Session</p>
      </div>
    );
  }

  // Tenant Transition Phase
  if (isTenant === true) {
      return (
        <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4 text-center px-6">
            <ShieldCheck className="h-16 w-16 text-primary animate-in zoom-in duration-500" />
            <div className="space-y-2">
                <h2 className="text-xl font-bold font-headline">Identity Verified</h2>
                <p className="text-muted-foreground text-sm font-medium">Entering Resident Hub...</p>
            </div>
        </div>
      );
  }

  // Identity Mapping screen: Shown during handshake phase
  if (!isLoadingProps && isLandlord === false && isTenant === null && !hasTimedOut) {
      return (
        <div className="max-w-md mx-auto mt-20 text-center space-y-8 px-6 animate-in fade-in duration-700">
            <div className="bg-primary/10 p-8 rounded-full w-fit mx-auto border shadow-inner">
                <Sparkles className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-primary">Identity Mapping</h2>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                    Our secure system is currently mapping your resident identity across the platform. This ensures your access is private and protected.
                </p>
                {isIndexBuilding && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100 mt-4">
                        <AlertCircle className="h-4 w-4" />
                        Cloud Indexing in Progress
                    </div>
                )}
            </div>
            <div className="space-y-3 pt-4">
                <Button 
                    variant="outline" 
                    className="font-bold h-11 px-10 rounded-xl uppercase tracking-widest text-[10px] w-full shadow-sm" 
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Check Identity Status
                </Button>
                <Button 
                    variant="ghost" 
                    className="font-bold h-11 px-10 rounded-xl uppercase tracking-widest text-[10px] w-full text-muted-foreground" 
                    onClick={() => { setIsTenant(false); setHasTimedOut(true); }}
                >
                    Continue to Portfolio Manager <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
            </div>
        </div>
      );
  }

  // Portfolio Manager Dashboard (Landlord View)
  if (isLandlord === true || isTenant === false || hasTimedOut) {
      if (properties.length === 0 && !isLoadingProps) {
          return (
            <div className="text-center py-20 animate-in fade-in">
                <div className="max-w-md mx-auto space-y-6">
                    <div className="bg-muted p-6 rounded-full w-fit mx-auto">
                        <Home className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                    <h2 className="text-2xl font-bold font-headline">Welcome to RentSafeUK</h2>
                    <p className="text-muted-foreground">Start by onboarding your first rental property or wait for a landlord to assign you to a tenancy.</p>
                    <Button asChild size="lg" className="px-10 font-bold shadow-lg">
                        <Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Add First Property</Link>
                    </Button>
                </div>
            </div>
          );
      }

      return (
        <div className="space-y-8 animate-in fade-in duration-500 text-left">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Portfolio Manager</h1>
            <p className="text-muted-foreground font-medium text-lg">Control center for your rental estate.</p>
          </div>
          <PropertiesPanel 
            properties={filteredProperties} 
            isLoading={isLoadingProps}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            view={view}
            setView={setView}
          />
        </div>
      );
  }

  return (
    <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resolving Identity...</p>
    </div>
  );
}

function PropertiesPanel({ properties, isLoading, searchTerm, setSearchTerm, view, setView }: { 
  properties: Property[], 
  isLoading: boolean, 
  searchTerm: string, 
  setSearchTerm: (s: string) => void,
  view: 'grid' | 'list',
  setView: (v: 'grid' | 'list') => void
}) {
  const router = useRouter();

  return (
    <Card className="shadow-lg border-none">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b bg-muted/5">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-left">My Portfolio</CardTitle>
          <CardDescription className="text-left">Manage and view your property records.</CardDescription>
        </div>
        <Button asChild className="font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-md"><Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Property</Link></Button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              id="dashboard-search"
              name="search"
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              placeholder="Search address..." 
              className="pl-8 h-10 bg-background" 
            />
          </div>
          <div className="flex items-center rounded-md bg-muted p-1 border">
            <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2" onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
        ) : properties.length > 0 ? (
          view === 'grid' ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map(p => (
                <Card key={p.id} className="group overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 cursor-pointer border-none shadow-md bg-card text-left" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                  <div className="relative aspect-[16/10] bg-muted overflow-hidden border-b">
                    {p.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.imageUrl} alt="Property" className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                    ) : <div className="flex items-center justify-center w-full h-full bg-primary/5"><Home className="h-16 w-16 text-primary/10" /></div>}
                  </div>
                  <CardHeader className="pb-3 px-4">
                    <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors">{[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}</CardTitle>
                    <CardDescription className="truncate">{p.address.city}, {p.address.postcode}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-between items-center mt-auto pt-4 px-4 border-t">
                    <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase">
                      <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms}</span>
                      <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>
                    </div>
                    <Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[9px] uppercase font-bold px-2 py-0">{p.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider pl-6">Address</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Type</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                      <TableCell className="font-bold text-sm pl-6 py-4 text-left">
                        {[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}
                        <div className="text-[11px] text-muted-foreground font-medium">{p.address.city}, {p.address.postcode}</div>
                      </TableCell>
                      <TableCell className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest text-left">{p.propertyType}</TableCell>
                      <TableCell className="text-left"><Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[9px] uppercase font-bold px-2 py-0">{p.status}</Badge></TableCell>
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 text-primary">
                          <Link href={`/dashboard/properties/${p.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : (
          <div className="text-center py-20 border-2 border-dashed rounded-3xl bg-muted/5 flex flex-col items-center gap-4 mx-2">
            <div className="p-6 rounded-full bg-background shadow-sm">
                <Home className="h-12 w-12 text-primary/20" />
            </div>
            <p className="font-bold text-lg">Your portfolio is empty</p>
            <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px] h-10 px-8 border-primary/20 hover:bg-primary/5 mt-2"><Link href="/dashboard/properties/add">Add First Property</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
