
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc, onSnapshot, collectionGroup, limit } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Bed, Bath, Home, Search, LayoutGrid, List, Eye, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
  propertyType: string;
  status: string;
  bedrooms: number;
  bathrooms: number;
  imageUrl?: string;
  userId: string;
}

export function PropertiesPanel() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [openMaintenanceMap, setOpenMaintenanceMap] = useState<Record<string, number>>({});

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'userProfiles', user.uid, 'properties'), where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']));
  }, [firestore, user]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) return;
    const unsubs = properties.map(p => onSnapshot(
      query(collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'maintenanceLogs'), where('status', 'in', ['Open', 'In Progress'])),
      (snap) => setOpenMaintenanceMap(prev => ({ ...prev, [p.id]: snap.size })),
      (error) => {
        // Silent fail for summary badges
      }
    ));
    return () => unsubs.forEach(u => u());
  }, [user, properties, firestore]);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (!searchTerm) return properties;
    const term = searchTerm.toLowerCase();
    return properties.filter(p => Object.values(p.address).some(val => val?.toLowerCase().includes(term)));
  }, [properties, searchTerm]);

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !propertyToDelete) return;
    try {
      await updateDoc(doc(firestore, 'userProfiles', user.uid, 'properties', propertyToDelete.id), { status: 'Deleted' });
      toast({ title: 'Property Archived', description: 'Moved to archived properties.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error archiving property.' });
    } finally {
      setPropertyToDelete(null);
    }
  };

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
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search address..." className="pl-8 h-10 bg-background" />
          </div>
          <div className="flex items-center rounded-md bg-muted p-1 border">
            <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
        ) : filteredProperties.length > 0 ? (
          view === 'grid' ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProperties.map(p => (
                <Card key={p.id} className="group overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 relative cursor-pointer" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                  <div className="relative aspect-[16/10] bg-muted overflow-hidden border-b">
                    {p.imageUrl ? (
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
                    <Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'} className="text-[10px] uppercase">{p.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Address</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProperties.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                    <TableCell className="font-bold">{[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}
                      <div className="text-[11px] text-muted-foreground font-medium">{p.address.city}, {p.address.postcode}</div>
                    </TableCell>
                    <TableCell className="text-xs uppercase text-muted-foreground font-bold">{p.propertyType}</TableCell>
                    <TableCell><Badge variant={p.status === 'Occupied' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/properties/${p.id}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        ) : <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/5">No properties found.</div>}
      </CardContent>

      <AlertDialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Property?</AlertDialogTitle>
            <AlertDialogDescription>This will move the property to your archived assets.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeleteConfirm}>Archive Record</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isTenant, setIsTenant] = useState<boolean | null>(null);
  const [isLoadingPortalCheck, setIsLoadingPortalCheck] = useState(true);

  useEffect(() => {
    if (!user || !firestore || !user.email) {
      setIsLoadingPortalCheck(false);
      return;
    }

    const email = user.email.toLowerCase().trim();
    // Identity discovery query to determine role access
    const tenantsQuery = query(
      collectionGroup(firestore, 'tenants'),
      where('email', '==', email),
      limit(1)
    );

    const unsub = onSnapshot(tenantsQuery, (snap) => {
      const activeTenant = snap.docs.find(d => d.data().status === 'Active');
      setIsTenant(!!activeTenant);
      setIsLoadingPortalCheck(false);
    }, (error) => {
      // Trigger global error propagation with explicit collection group context
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'tenants',
        operation: 'list',
      }));
      setIsLoadingPortalCheck(false);
    });

    return () => unsub();
  }, [user, firestore]);

  if (isLoadingPortalCheck) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Verifying Session Permissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Landlord Dashboard</h1>
          <p className="text-muted-foreground font-medium">Overview of your rental portfolio and active management tasks.</p>
        </div>
        {isTenant && (
          <Button variant="outline" asChild className="border-primary/20 bg-primary/5 hover:bg-primary/10">
            <Link href="/tenant/dashboard">Switch to Tenant Portal</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6">
        <PropertiesPanel />
      </div>
    </div>
  );
}
