
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowRight, 
  ShieldCheck, 
  UserCircle, 
  Sparkles,
  RefreshCw
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
          <CardTitle className="text-lg font-bold">My Properties</CardTitle>
          <CardDescription>Manage and view your property portfolio.</CardDescription>
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
                    ) : <div className="flex justify-center items-center w-full h-full bg-primary/5"><Home className="h-16 w-16 text-primary/10" /></div>}
                  </div>
                  <CardHeader className="pb-3 px-4">
                    <CardTitle className="text-lg font-bold truncate">{[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}</CardTitle>
                    <CardDescription>{p.address.city}, {p.address.postcode}</CardDescription>
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
                      <TableCell className="font-bold text-sm pl-6 py-4">
                        {[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}
                        <div className="text-[11px] text-muted-foreground font-medium">{p.address.city}, {p.address.postcode}</div>
                      </TableCell>
                      <TableCell className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">{p.propertyType}</TableCell>
                      <TableCell><Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[9px] uppercase font-bold px-2 py-0">{p.status}</Badge></TableCell>
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
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Start by adding your first rental property to access management tools.</p>
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
  const [retryCount, setRetryCount] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(true);

  // 1. Fetch Properties (Landlord Role)
  useEffect(() => {
    if (!user || !firestore) return;
    
    const propertiesQuery = query(
      collection(firestore, 'userProfiles', user.uid, 'properties'), 
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );

    const unsub = onSnapshot(propertiesQuery, (snap) => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
      setIsLoadingProps(false);
    }, (error) => {
      console.warn("Properties fetch restricted:", error.message);
      setIsLoadingProps(false);
    });
    return () => unsub();
  }, [user, firestore]);

  // 2. Discover Tenant Role with robust handling for cloud syncing delays
  useEffect(() => {
    if (!user || !firestore || !user.email) {
      setIsLoadingPortalCheck(false);
      return;
    }

    // Normalized matching for security and high performance
    const email = user.email.toLowerCase().trim();
    const tenantsQuery = query(
      collectionGroup(firestore, 'tenants'),
      where('email', '==', email),
      limit(5)
    );

    const unsub = onSnapshot(tenantsQuery, (snap) => {
      const activeTenant = snap.docs.find(d => d.data().status === 'Active');
      setIsTenant(!!activeTenant);
      setIsLoadingPortalCheck(false);
      setIsIndexBuilding(false); 
    }, (error) => {
      const msg = error.message.toLowerCase();
      // Handle cloud indexing states specifically to avoid showing a broken UI
      if (msg.includes('index') || error.code === 'failed-precondition') {
        setIsIndexBuilding(true);
      } else {
        console.warn("Tenant discovery handshake failure:", error.message);
        setIsIndexBuilding(false);
      }
      setIsLoadingPortalCheck(false);
    });

    return () => unsub();
  }, [user, firestore, retryCount]);

  const handleRetrySync = useCallback(() => {
    setIsLoadingPortalCheck(true);
    setRetryCount(prev => prev + 1);
  }, []);

  // 3. Auto-Redirect Pure Tenants once verified to their specific dashboard
  useEffect(() => {
    if (!isLoadingProps && !isLoadingPortalCheck && properties.length === 0 && isTenant) {
      router.push('/tenant/dashboard');
    }
  }, [isLoadingProps, isLoadingPortalCheck, properties.length, isTenant, router]);

  const filteredProperties = useMemo(() => {
    if (!searchTerm) return properties;
    const term = searchTerm.toLowerCase();
    return properties.filter(p => 
      Object.values(p.address).some(val => val?.toLowerCase().includes(term))
    );
  }, [properties, searchTerm]);

  const isLikelyPureTenant = !isLoadingProps && properties.length === 0;
  const pageTitle = isLikelyPureTenant ? "Tenant Dashboard" : "Landlord Dashboard";

  if (isUserLoading || (isLoadingProps && isLoadingPortalCheck)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse font-medium">Establishing Secure Session...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight transition-all duration-500">
            {pageTitle}
          </h1>
          <p className="text-muted-foreground font-medium text-lg">
            {isLikelyPureTenant 
              ? `Welcome home, ${user?.displayName?.split(' ')[0] || 'Tenant'}. Access your tenancy tools below.` 
              : "Overview of your rental portfolio and active management tasks."}
          </p>
        </div>
        
        {/* Tenant Verification Hub - Provides a manual refresh path during cloud indexing */}
        {(isTenant || isIndexBuilding) && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/30 border border-primary/5 shadow-sm">
            <Button 
              variant={isIndexBuilding ? "ghost" : "outline"}
              asChild={!isIndexBuilding}
              onClick={isIndexBuilding ? handleRetrySync : undefined}
              className="border-primary/20 bg-background hover:bg-primary/5 shadow-sm h-10 px-6 font-bold uppercase text-[10px] tracking-widest rounded-xl transition-all"
            >
              {isIndexBuilding ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Tenant Verification...
                </span>
              ) : (
                <Link href="/tenant/dashboard">
                  <span className="flex items-center gap-2 text-primary"><UserCircle className="h-4 w-4" /> Open Tenant Portal</span>
                </Link>
              )}
            </Button>
            {isIndexBuilding && (
              <div className="px-3">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[9px] font-bold animate-pulse">Cloud Sync Active</Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Verification Progress Alert for Tenants */}
      {(isTenant || isIndexBuilding) && isLikelyPureTenant && (
        <Card className="border-primary/20 bg-primary/[0.02] border-dashed shadow-sm overflow-hidden relative group transition-all hover:bg-primary/[0.04] text-left">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Sparkles className="h-16 w-16 text-primary" />
          </div>
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left relative z-10">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-primary font-bold">
                {isIndexBuilding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {isIndexBuilding ? "Secure Tenant Sync In Progress" : "Active Tenancy Verified"}
              </div>
              <p className="text-sm text-muted-foreground font-medium max-lg leading-relaxed">
                {isIndexBuilding 
                  ? "Our system is currently mapping your tenancy records across the cloud. This ensures your data remains private and secure. Your portal will be ready instantly." 
                  : "Your account is linked to an active tenancy. You can now securely manage repairs, view safety certificates, and message your landlord directly."}
              </p>
            </div>
            {!isIndexBuilding ? (
              <Button asChild className="font-bold uppercase tracking-widest text-xs shadow-lg shrink-0 px-10 h-12 rounded-xl group-hover:scale-105 transition-transform bg-primary hover:bg-primary/90">
                <Link href="/tenant/dashboard">Enter Tenant Portal <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            ) : (
                <Button onClick={handleRetrySync} variant="outline" className="font-bold uppercase tracking-widest text-xs shrink-0 px-10 h-12 rounded-xl border-2">
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh Portal
                </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Content Message for Landlords with 0 properties */}
      {!isLikelyPureTenant ? (
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
      ) : !isTenant && !isIndexBuilding && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
              <div className="bg-primary/5 p-10 rounded-full">
                  <Home className="h-16 w-16 text-primary/20" />
              </div>
              <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Welcome to RentSafeUK</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">You don't have any properties yet. Start building your portfolio or wait for a tenant verification to complete if you've been invited.</p>
              </div>
              <Button asChild size="lg" className="px-10 h-12 font-bold shadow-lg">
                  <Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-5 w-5" /> Onboard First Property</Link>
              </Button>
          </div>
      )}
    </div>
  );
}
