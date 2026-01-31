'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Bed, Bath, Trash2, Archive, Loader2, Edit, MoreVertical, Search } from 'lucide-react';
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
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useMemo, useState } from 'react';
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

// Define the Property type based on your Firestore structure
interface Property {
  id: string;
  address: string;
  propertyType: string;
  status: string;
  bedrooms: number;
  bathrooms: number;
  imageUrl: string;
  ownerId: string;
}

export default function PropertiesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const {
    data: properties,
    isLoading,
    error,
  } = useCollection<Property>(propertiesQuery);

  const filteredProperties = useMemo(() => {
    if (!properties) {
      return [];
    }
    if (!searchTerm) {
      return properties;
    }
    return properties.filter((property) =>
      property.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [properties, searchTerm]);


  const handleDeleteConfirm = async () => {
    if (!firestore || !propertyToDelete) return;
    try {
      const docRef = doc(firestore, 'properties', propertyToDelete.id);
      await updateDoc(docRef, { status: 'Deleted' });
      toast({
        title: 'Property Deleted',
        description: `${propertyToDelete.address} has been moved to the deleted properties list.`,
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
                <h1 className="text-3xl font-bold">My Properties</h1>
                <p className="text-muted-foreground">
                  View, manage, and add properties to your portfolio.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard/properties/deleted">
                    <Archive className="mr-2 h-4 w-4" /> View Archived
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
              <div className="relative w-full md:w-auto md:max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by address..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProperties.map((property) => {
                  const addressParts = property.address.split(',');
                  const mainAddress = addressParts[0]?.trim();
                  const subAddress = addressParts.slice(1).join(',').trim();

                  return (
                    <Card
                      key={property.id}
                      className="group overflow-hidden flex flex-col"
                    >
                      <Link href={`/dashboard/properties/${property.id}`} className="block">
                        <div className="overflow-hidden">
                          <Image
                            src={property.imageUrl}
                            alt={`Image of ${property.address}`}
                            width={400}
                            height={250}
                            className="object-cover w-full aspect-video group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      </Link>
                      <CardHeader className="flex-grow">
                        <div className="flex justify-between items-start gap-2">
                          <div className='flex-1 min-w-0'>
                              <CardTitle className="text-lg leading-tight font-semibold truncate">
                                  <Link href={`/dashboard/properties/${property.id}`} className="hover:underline">
                                      {mainAddress}
                                      {subAddress && <span className="text-sm font-normal text-muted-foreground">, {subAddress}</span>}
                                  </Link>
                              </CardTitle>
                          </div>
                          <div className="flex items-center gap-1">
                              <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'} className="h-fit">{property.status}</Badge>
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                          <MoreVertical className="h-4 w-4" />
                                      </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
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
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span>{property.propertyType}</span>
                            <span className="flex items-center gap-1"><Bed className="h-4 w-4" /> {property.bedrooms}</span>
                            <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.bathrooms}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
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
              This will delete the property at {propertyToDelete?.address}. You can restore it later from the 'View Deleted' page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
