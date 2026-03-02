'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
import { ArrowLeft, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useState } from 'react';
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
}

export default function DeletedPropertiesPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const deletedPropertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'userProfiles', user.uid, 'properties'),
            where('ownerId', '==', user.uid),
            where('status', '==', 'Deleted')
        );
    }, [firestore, user]);

    const { data: deletedProperties, isLoading, error } = useCollection<Property>(deletedPropertiesQuery);

    const handleRestore = async (propertyId: string, address: Property['address']) => {
        if (!firestore || !user) return;
        try {
            const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
            await updateDoc(docRef, { status: 'Vacant' });
            toast({
                title: 'Property Restored',
                description: `${[address.nameOrNumber, address.street].filter(Boolean).join(', ')} has been restored to your portfolio.`,
            });
        } catch (e) {
            console.error('Error restoring property:', e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not restore the property.' });
        }
    };

    const handleDeletePermanently = async () => {
        if (!firestore || !propertyToDelete || !user) return;
        setIsDeleting(true);
        try {
            const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', propertyToDelete.id);
            await deleteDoc(docRef);
            toast({
                title: 'Property Deleted Permanently',
                description: 'The property record has been removed from your database.',
            });
        } catch (e) {
            console.error('Error deleting property:', e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not permanently delete the property.' });
        } finally {
            setIsDeleting(false);
            setPropertyToDelete(null);
        }
    };

    const formatAddress = (address: Property['address']) => {
        return [[address.nameOrNumber, address.street].filter(Boolean).join(', '), address.city, address.postcode].filter(Boolean).join(', ');
    };

  return (
    <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/properties"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold">Deleted Properties</h1>
                <p className="text-muted-foreground">A list of properties that have been deleted from your portfolio.</p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Deleted Properties</CardTitle>
                <CardDescription>Restore these properties or delete them permanently.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : error ? (
                    <div className="text-center py-10 text-destructive">Error: {error.message}</div>
                ) : !deletedProperties?.length ? (
                     <div className="text-center py-10 text-muted-foreground">No deleted properties found.</div>
                ) : (
                <>
                    <div className="hidden rounded-md border md:block">
                        <Table>
                            <TableHeader><TableRow><TableHead>Address</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {deletedProperties.map((property) => (
                                <TableRow key={property.id}>
                                    <TableCell className="font-medium">{formatAddress(property.address)}</TableCell>
                                    <TableCell>{property.propertyType}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="sm" variant="outline" onClick={() => handleRestore(property.id, property.address)}><RefreshCw className="mr-2 h-4 w-4" /> Restore</Button>
                                        <Button size="sm" variant="destructive" onClick={() => setPropertyToDelete(property)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="grid gap-4 md:hidden">
                        {deletedProperties.map((property) => (
                            <Card key={property.id}>
                                <CardHeader>
                                    <CardTitle className="text-base">{[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}</CardTitle>
                                    <CardDescription>{`${property.address.city}, ${property.address.postcode}`}</CardDescription>
                                </CardHeader>
                                <CardFooter className="flex flex-col gap-2">
                                    <Button size="sm" variant="outline" className="w-full" onClick={() => handleRestore(property.id, property.address)}><RefreshCw className="mr-2 h-4 w-4" /> Restore</Button>
                                    <Button size="sm" variant="destructive" className="w-full" onClick={() => setPropertyToDelete(property)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </>
                )}
            </CardContent>
        </Card>
        <AlertDialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the property record at {[propertyToDelete?.address.nameOrNumber, propertyToDelete?.address.street].filter(Boolean).join(', ')}.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeletePermanently} disabled={isDeleting}>{isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Permanently</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
