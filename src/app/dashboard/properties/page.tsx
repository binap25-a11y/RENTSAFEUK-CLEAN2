
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Bed, Bath, Loader2, LayoutGrid, List, Eye, Home, Search, AlertCircle } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useMemo, useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  landlordId: string;
}

export default function PropertiesPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [openMaintenanceMap, setOpenMaintenanceMap] = useState<Record<string, number>>({});

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'), 
      where('landlordId', '==', user.uid), 
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) return;
    
    // Subscribe to maintenance counts for each property, including landlordId filter for security compliance
    const unsubs = properties.map(p => {
      const q = query(
        collection(firestore, 'repairs'), 
        where('landlordId', '==', user.uid),
        where('propertyId', '==', p.id), 
        where('status', 'in', ['Open', 'In Progress'])
      );

      return onSnapshot(q, 
        (snap) => {
          setOpenMaintenanceMap(prev => ({ ...prev, [p.id]: snap.size }));
        },
        async (err) => {
          if (err.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: 'repairs',
              operation: 'list'
            }));
          }
        }
      );
    });
    
    return () => unsubs.forEach(u => u());
  }, [user, properties, firestore]);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
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

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !propertyToDelete) return;
    try {
      await updateDoc(doc(firestore, 'properties', propertyToDelete.id), { status: 'Deleted' });
      toast({ title: 'Property Archived', description: 'Moved to archived properties.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error archiving property.' });
    } finally { setPropertyToDelete(null); }
  };
  
  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto text-left">
        <div className="flex justify-between items-center">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold font-headline text-primary">My Properties</h1>
                <p className="text-muted-foreground font-medium">Manage and view your property portfolio.</p>
            </div>
            <Button asChild><Link href="/dashboard/properties/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Property</Link></Button>
        </div>

         <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative w-full md:w-auto md:max-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="property-search" name="propertySearch" placeholder="Search address..." className="pl-8 h-10 bg-background" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex items-center rounded-md bg-muted p-1 border">
                  <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5" onClick={() => setView('grid')}><LayoutGrid className="h-4 w-4" /></Button>
                  <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5" onClick={() => setView('list')}><List className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-64 gap-2 text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm">Syncing portfolio...</p></div>
            ) : filteredProperties.length > 0 ? (
                view === 'grid' ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProperties.map((property) => (
                      <Card key={property.id} className="group overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 relative">
                          <div className="relative cursor-pointer aspect-[16/10] bg-muted overflow-hidden border-b" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>
                              {property.imageUrl ? (
                                <Image src={property.imageUrl} alt="Property" fill className="object-cover group-hover:scale-110 transition-transform duration-500" priority unoptimized />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/5"><Home className="w-16 h-16 text-primary/10" /></div>
                              )}
                              {openMaintenanceMap[property.id] > 0 && (
                                <div className="absolute top-3 right-3">
                                    <Badge variant="destructive" className="animate-pulse shadow-lg font-bold gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {openMaintenanceMap[property.id]}
                                    </Badge>
                                </div>
                              )}
                          </div>
                          <CardHeader className="pb-3">
                              <CardTitle className="text-lg font-bold truncate group-hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>{[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}</CardTitle>
                              <CardDescription className="truncate">{property.address.city}, {property.address.postcode}</CardDescription>
                          </CardHeader>
                          <CardContent className="flex justify-between items-center mt-auto pt-4 border-t">
                              <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground uppercase">
                                  <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {property.bedrooms}</span>
                                  <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {property.bathrooms}</span>
                              </div>
                              <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'} className="text-[10px] uppercase">{property.status}</Badge>
                          </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProperties.map((p) => (
                                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/dashboard/properties/${p.id}`)}>
                                    <TableCell className="font-bold">
                                        {[p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ')}
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
                </div>
              )
            ) : <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/5"><Home className="w-10 h-10 mx-auto opacity-10 mb-4" /><p>No properties found.</p></div>}
          </CardContent>
        </Card>
      <AlertDialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive Property?</AlertDialogTitle><AlertDialogDescription>This will move the property to your archived assets.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeleteConfirm}>Archive Record</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
