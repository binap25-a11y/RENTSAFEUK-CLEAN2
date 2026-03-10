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
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold">My Properties</CardTitle>
          <CardDescription>Manage and view your property portfolio.</CardDescription>
        </div>
        <Button asChild><Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Property</Link></Button>
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
                <Card key={p.id} className="group overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 cursor-pointer" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                  <div className="relative aspect-[16/10] bg-muted overflow-hidden border-b">
                    {p.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.imageUrl} alt="Property" className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500" />
                    ) : <div className="flex justify-center items-center w-full h-full bg-primary/5"><Home className="h-16 w-16 text-primary/10" /></div>}
                  </div>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold truncate">{[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}</CardTitle>
                    <CardDescription>{p.address.city}, {p.address.postcode}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-between items-center mt-auto pt-4 border-t">
                    <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase">
                      <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms}</span>
                      <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms}</span>
                    </div>
                    <Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold">{p.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Address</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Type</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.map(p => (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                      <TableCell className="font-bold text-sm">
                        {[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}
                        <div className="text-[11px] text-muted-foreground font-medium">{p.address.city}, {p.address.postcode}</div>
                      </TableCell>
                      <TableCell className="text-[10px] uppercase text-muted-foreground font-bold">{p.propertyType}</TableCell>
                      <TableCell><Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold">{p.status}</Badge></TableCell>
                      <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
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
          <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/5 flex flex-col items-center gap-4">
            <Home className="h-12 w-12 text-muted-foreground opacity-20" />
            <div>
              <p className="font-bold text-muted-foreground">No properties found in portfolio.</p>
              <p className="text-xs text-muted-foreground mt-1">Start by adding your first rental unit.</p>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/dashboard/properties/add">Add First Property</Link></Button>
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

  // 2. Discover Tenant Role with high-performance query
  useEffect(() => {
    if (!user || !firestore || !user.email) {
      setIsLoadingPortalCheck(false);
      return;
    }

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
      // Handle index building specifically to inform user rather than fail
      if (msg.includes('index') || msg.includes('failed-precondition')) {
        setIsIndexBuilding(true);
      } else {
        console.warn("Tenant discovery issue:", error.message);
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

  // 3. Auto-Redirect Pure Tenants once verified
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

  // Heading Logic: Users with 0 properties are greeted as tenants while background sync occurs
  const isLikelyPureTenant = !isLoadingProps && properties.length === 0;
  const pageTitle = isLikelyPureTenant ? "Tenant Dashboard" : "Landlord Dashboard";

  if (isUserLoading || (isLoadingProps && isLoadingPortalCheck)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse font-medium text-center">Establishing Secure Session...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
        
        {/* Tenant Verification Hub - Integrated into Dashboard */}
        {(isTenant || isIndexBuilding) && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/30 border border-primary/5 shadow-sm">
            <Button 
              variant="outline" 
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
                  <span className="flex items-center gap-2"><UserCircle className="h-4 w-4" /> Open Tenant Portal</span>
                </Link>
              )}
            </Button>
            {isIndexBuilding && (
              <div className="px-3 animate-pulse">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[9px] font-bold">Cloud Sync Active</Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feature Highlight for Tenants */}
      {(isTenant || isIndexBuilding) && (
        <Card className="border-primary/20 bg-primary/[0.02] border-dashed shadow-sm overflow-hidden relative group transition-all hover:bg-primary/[0.04]">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Sparkles className="h-16 w-16 text-primary" />
          </div>
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left relative z-10">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-primary font-bold">
                <ShieldCheck className="h-4 w-4" />
                {isIndexBuilding ? "Secure Tenant Sync In Progress" : "Active Tenancy Verified"}
              </div>
              <p className="text-sm text-muted-foreground font-medium max-w-lg leading-relaxed">
                {isIndexBuilding 
                  ? "Our system is currently mapping your tenant records. This ensures your tenancy data remains private and secure. Your portal will be ready instantly." 
                  : "Your account is linked to an active tenancy. You can now securely manage repairs, view safety certificates, and message your landlord directly."}
              </p>
            </div>
            {!isIndexBuilding && (
              <Button asChild className="font-bold shadow-lg shrink-0 px-10 h-12 rounded-xl group-hover:scale-105 transition-transform">
                <Link href="/tenant/dashboard">Enter Tenant Portal <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isLikelyPureTenant && (
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
      )}
    </div>
  );
}