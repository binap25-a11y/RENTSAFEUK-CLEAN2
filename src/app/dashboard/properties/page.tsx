'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Bed, 
  Bath, 
  Trash2, 
  Archive, 
  Loader2, 
  Edit, 
  MoreVertical, 
  Search, 
  LayoutGrid, 
  List, 
  Eye, 
  Home,
  Download,
  AlertCircle
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  onSnapshot,
  limit,
  getDocs,
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useMemo, useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  ownerId: string;
}

export default function PropertiesPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [isCheckingSafeguards, setIsCheckingSafeguards] = useState(false);
  const [safeguardWarning, setSafeguardWarning] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  
  const [openMaintenanceMap, setOpenMaintenanceMap] = useState<Record<string, number>>({});

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const {
    data: properties,
    isLoading,
    error,
  } = useCollection<Property>(propertiesQuery);

  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) {
        setOpenMaintenanceMap({});
        return;
    }

    const unsubs: (() => void)[] = [];

    properties.forEach((p) => {
        const q = query(
            collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'maintenanceLogs'),
            where('status', 'in', ['Open', 'In Progress'])
        );
        const unsub = onSnapshot(q, (snap) => {
            setOpenMaintenanceMap(prev => ({ ...prev, [p.id]: snap.size }));
        });
        unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [user, properties, firestore]);

  useEffect(() => {
    if (!propertyToDelete || !user || !firestore) {
        setSafeguardWarning(null);
        return;
    }

    const checkSafeguards = async () => {
        setIsCheckingSafeguards(true);
        try {
            const tenantSnap = await getDocs(query(
                collection(firestore, 'userProfiles', user.uid, 'properties', propertyToDelete.id, 'tenants'),
                where('status', '==', 'Active'),
                limit(1)
            ));

            const maintenanceSnap = await getDocs(query(
                collection(firestore, 'userProfiles', user.uid, 'properties', propertyToDelete.id, 'maintenanceLogs'),
                where('status', 'in', ['Open', 'In Progress']),
                limit(1)
            ));

            let warning = "";
            if (!tenantSnap.empty) warning += "This property has an active tenant. ";
            if (!maintenanceSnap.empty) warning += "This property has open maintenance logs. ";
            
            setSafeguardWarning(warning || null);
        } catch (e) {
            console.error("Safeguard check failed", e);
        } finally {
            setIsCheckingSafeguards(false);
        }
    };

    checkSafeguards();
  }, [propertyToDelete, user, firestore]);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (!searchTerm) return properties;
    const lowercasedTerm = searchTerm.toLowerCase();
    return properties.filter((property) =>
      Object.values(property.address).some(val => val?.toLowerCase().includes(lowercasedTerm))
    );
  }, [properties, searchTerm]);

  const exportToCSV = () => {
    if (!filteredProperties.length) return;
    
    const headers = ["Address", "County", "Type", "Status", "Bedrooms", "Bathrooms", "Postcode", "Open Maintenance"];
    const rows = filteredProperties.map(p => [
      `"${[p.address.nameOrNumber, p.address.street, p.address.city].filter(Boolean).join(', ')}"`,
      p.address.county || '',
      p.propertyType,
      p.status,
      p.bedrooms,
      p.bathrooms,
      p.address.postcode,
      openMaintenanceMap[p.id] || 0
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "rentsafe_portfolio_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Export Successful", description: "Your property list has been exported to CSV." });
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !propertyToDelete) return;
    try {
      const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', propertyToDelete.id);
      await updateDoc(docRef, { status: 'Deleted' });
      toast({
        title: 'Property Deleted',
        description: `${propertyToDelete.address.street} has been moved to the deleted properties list.`,
      });
    } catch (e) {
      console.error('Error deleting property:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the property. Please try again.',
      });
    } finally {
        setPropertyToDelete(null);
    }
  };
  
  return (
    <>
      <div className="flex flex-col gap-8">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">My Properties</h1>
            <p className="text-muted-foreground font-medium text-lg">
              View, manage, and add properties to your portfolio.
            </p>
        </div>

         <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Your Portfolio</CardTitle>
                <CardDescription>An overview of all active property assets.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-auto md:max-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by address..."
                      className="pl-8 h-10 bg-background"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center rounded-md bg-muted p-1 border">
                    <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5 shadow-sm" onClick={() => setView('grid')}>
                        <LayoutGrid className="h-4 w-4" />
                        <span className="sr-only">Grid View</span>
                    </Button>
                    <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5" onClick={() => setView('list')}>
                        <List className="h-4 w-4" />
                        <span className="sr-only">List View</span>
                    </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-64 gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Syncing portfolio...</p>
              </div>
            ) : error ? (
                <div className="text-center py-10 text-destructive font-medium border border-destructive/20 rounded-lg bg-destructive/5">
                  Error loading properties: {error.message}
                </div>
            ) : !properties?.length ? (
              <div className="text-center py-24 border-2 border-dashed rounded-2xl bg-muted/5">
                 <div className="bg-background p-4 rounded-full shadow-sm w-fit mx-auto mb-4">
                    <Home className="w-10 h-10 text-muted-foreground opacity-20" />
                 </div>
                 <h3 className="text-xl font-bold">Your portfolio is empty</h3>
                <p className="text-muted-foreground mb-6 mt-1 max-w-sm mx-auto">Get started by adding your first investment property to track its performance and compliance.</p>
                 <Button asChild size="lg" className="font-bold px-8 shadow-md">
                    <Link href="/dashboard/properties/add">
                        <PlusCircle className="mr-2 h-5 w-5" /> Add First Property
                    </Link>
                </Button>
              </div>
            ) : filteredProperties.length > 0 ? (
                view === 'grid' ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProperties.map((property) => (
                      <Card
                          key={property.id}
                          className="group overflow-hidden flex flex-col hover:shadow-2xl transition-all duration-300 relative border-muted/60"
                      >
                          {openMaintenanceMap[property.id] > 0 && (
                              <div className="absolute top-3 left-3 z-10">
                                  <Badge variant="destructive" className="flex items-center gap-1 shadow-md animate-pulse">
                                      <AlertCircle className="h-3 w-3" />
                                      {openMaintenanceMap[property.id]} Open Issue{openMaintenanceMap[property.id] > 1 ? 's' : ''}
                                  </Badge>
                              </div>
                          )}
                          <div className="relative cursor-pointer" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>
                              <div className="aspect-[16/10] bg-muted overflow-hidden relative border-b">
                                  {property.imageUrl ? (
                                      <Image src={property.imageUrl} alt="Property" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-primary/5">
                                          <Home className="w-16 h-16 text-primary/10" />
                                      </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </div>
                          </div>
                          <CardHeader className="flex flex-row items-start justify-between pb-3">
                              <div className="space-y-1.5 cursor-pointer flex-grow min-w-0" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>
                                  <CardTitle className="text-lg leading-tight font-bold group-hover:text-primary transition-colors truncate">
                                      {[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}
                                  </CardTitle>
                                  <CardDescription className="truncate font-medium">
                                      {[property.address.city, property.address.county, property.address.postcode].filter(Boolean).join(', ')}
                                  </CardDescription>
                              </div>
                              <div className="flex-shrink-0 ml-2" onClick={(e) => { e.stopPropagation() }}>
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted rounded-full">
                                              <MoreVertical className="h-4 w-4" />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-40">
                                          <DropdownMenuItem asChild>
                                              <Link href={`/dashboard/properties/${property.id}`} className="cursor-pointer">
                                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                              </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild>
                                              <Link href={`/dashboard/properties/${property.id}/edit`} className="cursor-pointer">
                                                  <Edit className="mr-2 h-4 w-4" /> Edit Record
                                              </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onSelect={() => setPropertyToDelete(property)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                              <Trash2 className="mr-2 h-4 w-4" /> Archive Asset
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                          </CardHeader>
                          <CardContent className="flex-grow flex flex-col justify-end cursor-pointer mt-auto" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>
                              <div className="flex justify-between items-center pt-4 border-t border-muted/60">
                                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted-foreground uppercase tracking-tight">
                                      <span>{property.propertyType}</span>
                                      <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {property.bedrooms}</span>
                                      <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {property.bathrooms}</span>
                                  </div>
                                  <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'} className="h-fit text-[10px] font-bold uppercase tracking-wider">{property.status}</Badge>
                              </div>
                          </CardContent>
                      </Card>
                    ))}
                </div>
              ) : (
                <div className="rounded-xl border border-muted/60 overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Address</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Type</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Status</TableHead>
                                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Maintenance</TableHead>
                                <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProperties.map((property) => (
                                <TableRow 
                                  key={property.id} 
                                  className="cursor-pointer hover:bg-muted/30 transition-colors group" 
                                  onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                                >
                                    <TableCell className="font-bold py-4">
                                          <div className="group-hover:text-primary transition-colors">
                                            {[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground font-medium">
                                              {[property.address.city, property.address.county, property.address.postcode].filter(Boolean).join(', ')}
                                          </div>
                                    </TableCell>
                                    <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">
                                      {property.propertyType}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'} className="text-[10px] font-bold uppercase">
                                            {property.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {openMaintenanceMap[property.id] > 0 ? (
                                            <Badge variant="destructive" className="gap-1 text-[10px] font-bold">
                                                <AlertCircle className="h-3 w-3" />
                                                {openMaintenanceMap[property.id]} Open
                                            </Badge>
                                        ) : (
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">Clear</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                            <Link href={`/dashboard/properties/${property.id}`}>
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                            <Link href={`/dashboard/properties/${property.id}/edit`}>
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-40">
                                                <DropdownMenuItem onSelect={() => setPropertyToDelete(property)} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Archive Asset
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
              )
            ) : (
                <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5">
                    <Search className="h-10 w-10 mx-auto opacity-10 mb-4" />
                    <p className="font-bold">No assets found for "{searchTerm}"</p>
                    <p className="text-xs mt-1">Try a different search term or street name.</p>
                </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 px-1">
            <div className="flex items-center gap-3 w-full">
                <Button asChild variant="outline" className="flex-1 font-bold shadow-sm h-11 px-6 border-primary/20 hover:bg-primary/5 transition-all">
                  <Link href="/dashboard/properties/deleted">
                      <Archive className="mr-2 h-4 w-4 text-primary" /> View Deleted
                  </Link>
                </Button>
                <Button asChild className="flex-1 font-bold shadow-lg h-11 px-8 bg-primary hover:bg-primary/90 transition-all">
                  <Link href="/dashboard/properties/add">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Property
                  </Link>
                </Button>
            </div>
            
            <Button 
              variant="ghost" 
              className="font-bold text-muted-foreground hover:text-primary transition-all w-full h-11 px-6 border border-dashed hover:border-primary/50" 
              onClick={exportToCSV} 
              disabled={!filteredProperties.length}
            >
                <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
        </div>
      </div>

      <AlertDialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Archive Property?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {isCheckingSafeguards ? (
                <div className="flex items-center gap-3 py-4 text-primary font-bold"><Loader2 className="h-5 w-5 animate-spin" /> Performing safeguard audit...</div>
              ) : safeguardWarning ? (
                <div className="p-5 rounded-2xl bg-destructive/10 border-2 border-destructive/20 text-destructive">
                    <p className="flex items-center gap-2 font-bold mb-2"><AlertCircle className="h-5 w-5" /> Safeguard Warning:</p>
                    <p className="text-sm font-medium leading-relaxed">{safeguardWarning} Archive anyway?</p>
                </div>
              ) : (
                <span className="font-medium">This will move <strong className="text-foreground">{[propertyToDelete?.address.nameOrNumber, propertyToDelete?.address.street].filter(Boolean).join(', ')}</strong> to your archived assets.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-xs h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-lg"
              onClick={handleDeleteConfirm}
              disabled={isCheckingSafeguards}
            >
              Archive Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
