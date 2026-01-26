'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Bed, Bath, Trash2, Archive, Loader2 } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  WithId,
} from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

// Define the Property type based on your Firestore structure
interface Property {
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

  const handleDelete = async (propertyId: string, address: string) => {
    if (!firestore) return;
    const isConfirmed = confirm(
      `Are you sure you want to delete the property at ${address}?`
    );
    if (isConfirmed) {
      try {
        const docRef = doc(firestore, 'properties', propertyId);
        await updateDoc(docRef, { status: 'Deleted' });
        toast({
          title: 'Property Deleted',
          description: `${address} has been moved to the deleted properties list.`,
        });
      } catch (e) {
        console.error('Error deleting property:', e);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not delete the property. Please try again.',
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Properties</h1>
          <p className="text-muted-foreground">
            A list of all properties in your portfolio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/properties/deleted">
              <Archive className="mr-2 h-4 w-4" /> View Deleted
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/properties/add">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Property
            </Link>
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && error && (
        <Card className="flex justify-center items-center h-64">
            <p className="text-destructive">Error loading properties: {error.message}</p>
        </Card>
      )}

      {!isLoading && !properties?.length && (
         <Card className="flex flex-col justify-center items-center h-64 text-center">
          <CardHeader>
            <CardTitle>No Properties Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Get started by adding your first property.</p>
            <Button asChild>
              <Link href="/dashboard/properties/add">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Property
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && (properties?.length ?? 0) > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties?.map((property) => (
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
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">
                    <Link
                      href={`/dashboard/properties/${property.id}`}
                      className="hover:underline"
                    >
                      {property.address}
                    </Link>
                  </CardTitle>
                  <Badge
                    variant={
                      property.status === 'Occupied' ? 'default' : 'secondary'
                    }
                  >
                    {property.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{property.propertyType}</span>
                  <span className="flex items-center gap-1">
                    <Bed className="h-4 w-4" /> {property.bedrooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="h-4 w-4" /> {property.bathrooms}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="flex items-center gap-2">
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/dashboard/properties/${property.id}`}>
                    View Details
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDelete(property.id, property.address)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete Property</span>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
