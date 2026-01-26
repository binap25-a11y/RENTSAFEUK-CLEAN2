'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';

interface Property {
  address: string;
  propertyType: string;
}

export default function DeletedPropertiesPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const deletedPropertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'properties'),
            where('ownerId', '==', user.uid),
            where('status', '==', 'Deleted')
        );
    }, [firestore, user]);

    const { data: deletedProperties, isLoading, error } = useCollection<Property>(deletedPropertiesQuery);

    const handleRestore = async (propertyId: string, address: string) => {
        if (!firestore) return;
        try {
            const docRef = doc(firestore, 'properties', propertyId);
            await updateDoc(docRef, { status: 'Vacant' });
            toast({
                title: 'Property Restored',
                description: `${address} has been restored to your portfolio.`,
            });
        } catch (e) {
            console.error('Error restoring property:', e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not restore the property. Please try again.',
            });
        }
    };

  return (
    <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/properties">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold">Deleted Properties</h1>
                <p className="text-muted-foreground">
                    A list of properties that have been deleted from your portfolio.
                </p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Deleted Properties</CardTitle>
                <CardDescription>You can restore these properties to your active portfolio.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            )}
                             {!isLoading && error && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center text-destructive">
                                        Error: {error.message}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && deletedProperties && deletedProperties.length > 0 ? (
                                deletedProperties.map((property) => (
                                <TableRow key={property.id}>
                                    <TableCell className="font-medium">{property.address}</TableCell>
                                    <TableCell>{property.propertyType}</TableCell>
                                    <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleRestore(property.id, property.address)}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Restore
                                    </Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                !isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            No deleted properties.
                                        </TableCell>
                                    </TableRow>
                                )
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

    