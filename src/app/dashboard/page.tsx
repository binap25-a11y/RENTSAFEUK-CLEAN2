
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
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
  ShieldCheck, 
  Sparkles,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

export function PropertiesPanel({ properties, isLoading, searchTerm, setSearchTerm, view, setView }: { 
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
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 text-left">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold">My Portfolio</CardTitle>
          <CardDescription>Manage and view your property records.</CardDescription>
        </div>
        <Button asChild className="font-bold uppercase tracking-widest text-[10px] h-10 px-6 shadow-md"><Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Property</Link></Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              id="dash-prop-search"
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
                    <CardTitle className="text-lg font-bold truncate">{[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}</CardTitle>
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
            <div>
              <p className="font-bold text-lg">Your portfolio is empty</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Start by onboarding your first rental property to access the audit trail.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="font-bold uppercase tracking-widest text-[10px] h-10 px-8 border-primary/20 hover:bg-primary/5 mt-2"><Link href="/dashboard/properties/add">Add First Property</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [isTenant, setIsTenant] = useState<boolean>(false);
  const [isLoadingPortalCheck, setIsLoadingPortalCheck] = useState(true);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const [hasHeuristicTimeout, setHasHeuristicTimeout] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(true);

  // Discovery Heuristic: Ensures redirection happens as soon as a tenant record is found.
  useEffect(() => {
    if (!user || !firestore || !user.email) {
      setIsLoadingPortalCheck(false);
      return;
    }

    const email = user.email.toLowerCase().trim();
    const tenantsQuery = query(
      collectionGroup(firestore, 'tenants'),
      where('email', '==', email),
      limit(1)
    );

    const unsub = onSnapshot(tenantsQuery, (snap) => {
      const activeTenant = snap.docs.find(d => d.data().status === 'Active');
      if (activeTenant) {
          setIsTenant(true);
          router.replace('/tenant/dashboard');
      } else {
          setIsTenant(false);
      }
      setIsLoadingPortalCheck(false);
      setIsIndexBuilding(false); 
    }, (error) => {
      const msg = error.message.toLowerCase();
      if (msg.includes('index') || error.code === 'failed-precondition') {
        setIsIndexBuilding(true);
      }
      setIsLoadingPortalCheck(false);
    });

    return () => unsub();
  }, [user, firestore, router]);

  // Loading safety timeout
  useEffect(() => {
    const timer = setTimeout(() => {
        setHasHeuristicTimeout(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Fetch Properties (Landlord Role)
  useEffect(() => {
    if (!user || !firestore) return;
    
    const propertiesQuery = query(
      collection(firestore, 'userProfiles', user.uid, 'properties'), 
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );

    const unsub = onSnapshot(propertiesQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
      setProperties(list);
      setIsLoadingProps(false);
    }, () => {
      setIsLoadingProps(false);
    });
    return () => unsub();
  }, [user, firestore]);

  const filteredProperties = useMemo(() => {
    if (!searchTerm) return properties;
    const term = searchTerm.toLowerCase();
    return properties.filter(p => 
      Object.values(p.address).some(val => val?.toLowerCase().includes(term))
    );
  }, [properties, searchTerm]);

  // Redirection bypass: If we know it's a tenant, don't wait for landlords checks.
  useEffect(() => {
    if (isTenant) {
        router.replace('/tenant/dashboard');
    }
  }, [isTenant, router]);

  const isLandlordKnown = properties.length > 0;
  const isGlobalLoading = !isLandlordKnown && !isTenant && (isUserLoading || ((isLoadingPortalCheck || isIndexBuilding) && !hasHeuristicTimeout));

  if (isGlobalLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6">
        <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-primary opacity-20" />
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground animate-pulse">
                {isIndexBuilding ? "Database Synchronization" : "Identity Handshake"}
            </p>
            <h2 className="text-xl font-bold font-headline">Securing Connection</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
                {isIndexBuilding 
                    ? "Our cloud database is currently indexing your records for private portal access. This typically takes 5-10 minutes for new accounts." 
                    : "Establishing a secure connection to your property records..."}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full pt-4">
            {isIndexBuilding && (
                <Button 
                    variant="outline" 
                    className="font-bold text-[10px] uppercase tracking-widest h-11 rounded-xl"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh Status
                </Button>
            )}
            <Button 
                variant="ghost" 
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-primary transition-all group"
                onClick={() => setHasHeuristicTimeout(true)}
            >
                Continue as Landlord <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">
            Portfolio Manager
          </h1>
          <p className="text-muted-foreground font-medium text-lg">
            Landlord control center for estate management.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <PropertiesPanel 
          properties={filteredProperties} 
          isLoading={isLoadingProps}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          view={view}
          setView={setView}
        />
      </div>
    </div>
  );
}
