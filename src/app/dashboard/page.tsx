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
  AlertCircle,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

/**
 * @fileOverview High-Performance Role Router.
 * Resolves Landlord/Tenant identities in parallel and handles the handshake state.
 * Fixed: All hooks are now declared at the absolute top level to prevent runtime crashes.
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(true);
  const [isTenant, setIsTenant] = useState<boolean | null>(null);
  const [isLandlord, setIsLandlord] = useState<boolean | null>(null);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // 1. Role resolution logic
  useEffect(() => {
    if (isUserLoading || !user || !firestore) return;
    
    const userEmail = user.email?.toLowerCase().trim();

    // Landlord Check: Scoped to user profile
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
      console.warn("Portfolio access restricted:", error.message);
      setIsLoadingProps(false);
      setIsLandlord(false);
    });

    // Tenant Check: Secure global identity handshake
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
            } else if (snap.size > 0) {
                // Found tenant records but none are active
                setIsTenant(false);
            } else {
                setIsTenant(false);
            }
            setIsIndexBuilding(false);
        }, (error) => {
            if (error.message.toLowerCase().includes('index') || error.code === 'failed-precondition') {
                setIsIndexBuilding(true);
            } else {
                console.warn("Tenant discovery handshake interrupted:", error.message);
                setIsTenant(false);
            }
        });
    } else {
        setIsTenant(false);
    }

    return () => {
        unsubProps();
        unsubTenants();
    };
  }, [user, isUserLoading, firestore]);

  // 2. Safety Timeout for Identity Discovery
  useEffect(() => {
    if (isTenant === null) {
        const timer = setTimeout(() => {
            setHasTimedOut(true);
        }, 6000);
        return () => clearTimeout(timer);
    }
  }, [isTenant]);

  // 3. Tenant Redirection
  useEffect(() => {
    if (isTenant === true) {
        router.replace('/tenant/dashboard');
    }
  }, [isTenant, router]);

  // 4. Memoized Data Processing
  const filteredProperties = useMemo(() => {
    if (!searchTerm) return properties;
    const term = searchTerm.toLowerCase();
    return properties.filter(p => 
      Object.values(p.address).some(val => typeof val === 'string' && val.toLowerCase().includes(term))
    );
  }, [properties, searchTerm]);

  // 5. Render Logic
  if (isUserLoading || (isTenant === true && !hasTimedOut)) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Establishing Portal Access</p>
      </div>
    );
  }

  // Identity discovery handshake
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
                        Indexing Resident Records...
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
                    onClick={() => setHasTimedOut(true)}
                >
                    Continue to Portfolio Manager <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
            </div>
        </div>
      );
  }

  // Final Dashboard / Empty State
  if (isLandlord === true || isTenant === false || hasTimedOut) {
      if (properties.length === 0 && !isLoadingProps) {
          return (
            <div className="text-center py-20">
                <div className="max-w-md mx-auto space-y-6 px-6 text-left">
                    <div className="bg-muted p-6 rounded-full w-fit mx-auto shadow-inner">
                        <Home className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                    <h2 className="text-2xl font-bold font-headline text-center">Welcome to RentSafeUK</h2>
                    <p className="text-muted-foreground font-medium text-center">Onboard your first rental property or wait for an assignment to a tenancy hub.</p>
                    <Button asChild size="lg" className="px-10 font-bold shadow-lg h-12 w-full">
                        <Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Asset</Link>
                    </Button>
                </div>
            </div>
          );
      }

      return (
        <div className="space-y-8 animate-in fade-in duration-500 text-left">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Portfolio Manager</h1>
            <p className="text-muted-foreground font-medium text-lg">Central control for your rental estate.</p>
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
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Authorizing Session...</p>
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
    <Card className="shadow-lg border-none overflow-hidden">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b bg-muted/5">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-left">Estate View</CardTitle>
          <CardDescription className="text-left">Live status of your property records.</CardDescription>
        </div>
        <Button asChild className="font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-md"><Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Asset</Link></Button>
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
              placeholder="Filter by address..." 
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
            <p className="font-bold text-lg">Portfolio record empty</p>
            <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px] h-10 px-8 border-primary/20 hover:bg-primary/5 mt-2"><Link href="/dashboard/properties/add">Onboard First Property</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
