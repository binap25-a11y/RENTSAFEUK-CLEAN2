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

// Define the Property type
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
  
  // Real-time maintenance aggregation state
  const [openMaintenanceMap, setOpenMaintenanceMap] = useState<Record<string, number>>({});

  // Strictly hierarchical properties query
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

  // Aggregation: Real-time count of open maintenance for each property
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

  // Safeguard check before deletion
  useEffect(() => {
    if (!propertyToDelete || !user || !firestore) {
        setSafeguardWarning(null);
        return;
    }

    const checkSafeguards = async () => {
        setIsCheckingSafeguards(true);
        try {
            // Check for active tenants
            const tenantSnap = await getDocs(query(
                collection(firestore, 'userProfiles', user.uid, 'properties', propertyToDelete.id, 'tenants'),
                where('status', '==', 'Active'),
                limit(1)
            ));

            // Check for open maintenance logs
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
            <div>
                <h1 className="text-3xl font-bold font-headline">My Properties</h1>
                <p className="text-muted-foreground">
                  View, manage, and add properties to your portfolio.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto" onClick={exportToCSV} disabled={!filteredProperties.length}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard/properties/deleted">
                    <Archive className="mr-2 h-4 w-4" /> View Deleted
                </Link>
                </Button>
                <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/properties/add">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Property
                </Link>
                </Button>
            </div>
        </div>

         <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Your Portfolio</CardTitle>
                <CardDescription>An overview of all active properties.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-auto md:max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by address..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center rounded-md bg-muted p-1">
                    <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="sm" className="h-8 px-2.5" onClick={() => setView('grid')}>
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
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
                <div className="text-center py-10 text-destructive">Error loading properties: {error.message}</div>
            ) : !properties?.length ? (
              <div className="text-center py-20">
                 <h3 className="text-lg font-semibold">No Properties Found</h3>
                <p className="text-muted-foreground mb-4 mt-1">Get started by adding your first property.</p>
                 <Button asChild>
                    <Link href="/dashboard/properties/add">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Property
                    </Link>
                </Button>
              </div>
            ) : filteredProperties.length > 0 ? (
                view === 'grid' ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProperties.map((property) => (
                      <Card
                          key={property.id}
                          className="group overflow-hidden flex flex-col hover:shadow-lg transition-shadow relative"
                      >
                          {openMaintenanceMap[property.id] > 0 && (
                              <div className="absolute top-2 left-2 z-10">
                                  <Badge variant="destructive" className="flex items-center gap-1 shadow-sm">
                                      <AlertCircle className="h-3 w-3" />
                                      {openMaintenanceMap[property.id]} Open Issue{openMaintenanceMap[property.id] > 1 ? 's' : ''}
                                  </Badge>
                              </div>
                          )}
                          <div className="relative cursor-pointer" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>
                              <div className="aspect-[16/10] bg-muted overflow-hidden relative">
                                  {property.imageUrl ? (
                                      <Image src={property.imageUrl} alt="Property" fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                                  ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                          <Home className="w-12 h-12 text-muted-foreground" />
                                      </div>
                                  )}
                              </div>
                          </div>
                          <CardHeader className="flex flex-row items-start justify-between pb-2">
                              <div className="space-y-1.5 cursor-pointer flex-grow" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>
                                  <CardTitle className="text-lg leading-tight font-semibold group-hover:underline">
                                      {[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}
                                  </CardTitle>
                                  <CardDescription className="truncate">
                                      {[property.address.city, property.address.county, property.address.postcode].filter(Boolean).join(', ')}
                                  </CardDescription>
                              </div>
                              <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation() }}>
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 text-muted-foreground">
                                              <MoreVertical className="h-4 w-4" />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                          <DropdownMenuItem asChild>
                                              <Link href={`/dashboard/properties/${property.id}`}>
                                                  <Eye className="mr-2 h-4 w-4" /> View
                                              </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild>
                                              <Link href={`/dashboard/properties/${property.id}/edit`}>
                                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                              </Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onSelect={() => setPropertyToDelete(property)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                          </CardHeader>
                          <CardContent className="flex-grow flex flex-col justify-end cursor-pointer mt-auto" onClick={() => router.push(`/dashboard/properties/${property.id}`)}>
                              <div className="flex justify-between items-center pt-4 border-t">
                                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                      <span>{property.propertyType}</span>
                                      <span className="flex items-center gap-1"><Bed className="h-4 w-4" /> {property.bedrooms}</span>
                                      <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.bathrooms}</span>
                                  </div>
                                  <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'} className="h-fit">{property.status}</Badge>
                              </div>
                          </CardContent>
                      </Card>
                    )
                    )}
                </div>
              ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Maintenance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProperties.map((property) => (
                                <TableRow 
                                  key={property.id} 
                                  className="cursor-pointer" 
                                  onClick={() => router.push(`/dashboard/properties/${property.id}`)}
                                >
                                    <TableCell className="font-medium">
                                          <div>{[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}</div>
                                          <div className="text-xs text-muted-foreground">
                                              {[property.address.city, property.address.county, property.address.postcode].filter(Boolean).join(', ')}
                                          </div>
                                    </TableCell>
                                    <TableCell>{property.propertyType}</TableCell>
                                    <TableCell>
                                        <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'}>
                                            {property.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {openMaintenanceMap[property.id] > 0 ? (
                                            <Badge variant="destructive" className="gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                {openMaintenanceMap[property.id]} Open
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">Clear</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                                  <MoreVertical className="h-4 w-4" />
                                              </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                               <DropdownMenuItem asChild>
                                                  <Link href={`/dashboard/properties/${property.id}`}>
                                                      <Eye className="mr-2 h-4 w-4" /> View
                                                  </Link>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem asChild>
                                                  <Link href={`/dashboard/properties/${property.id}/edit`}>
                                                      <Edit className="mr-2 h-4 w-4" /> Edit
                                                  </Link>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setPropertyToDelete(property)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                              </DropdownMenuItem>
                                          </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
              )
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <p>No properties match your search for "{searchTerm}".</p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCheckingSafeguards ? (
                <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Performing safeguard check...</div>
              ) : safeguardWarning ? (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive text-destructive font-semibold">
                    <p className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Safeguard Warning:</p>
                    <p className="text-sm mt-1">{safeguardWarning} Are you sure you want to delete this property record anyway?</p>
                </div>
              ) : (
                `This will delete the property at ${[propertyToDelete?.address.nameOrNumber, propertyToDelete?.address.street].filter(Boolean).join(', ')}. You can restore it later from the 'View Deleted' page.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={isCheckingSafeguards}
            >
              Delete Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
