
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
            collection(firestore, 'properties'),
            where('landlordId', '==', user.uid),
            where('status', '==', 'Deleted')
        );
    }, [firestore, user]);

    const { data: deletedProperties, isLoading, error } = useCollection<Property>(deletedPropertiesQuery);

    const handleRestore = async (propertyId: string, address: Property['address']) => {
        if (!firestore || !user) return;
        try {
            const docRef = doc(firestore, 'properties', propertyId);
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
            const docRef = doc(firestore, 'properties', propertyToDelete.id);
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
    <div className="flex flex-col gap-6 text-left">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/properties"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold">Archived Assets</h1>
                <p className="text-muted-foreground">Manage properties that have been removed from your active portfolio.</p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Archived List</CardTitle>
                <CardDescription>Restore these properties or delete them permanently from the system.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : error ? (
                    <div className="text-center py-10 text-destructive font-medium">Error: {error.message}</div>
                ) : !deletedProperties?.length ? (
                     <div className="text-center py-10 text-muted-foreground italic">No archived properties found.</div>
                ) : (
                <>
                    <div className="hidden rounded-md border md:block overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-wider pl-6 py-4">Address</TableHead>
                                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Type</TableHead>
                                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deletedProperties.map((property) => (
                                <TableRow key={property.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-medium pl-6 py-4">{formatAddress(property.address)}</TableCell>
                                    <TableCell className="text-xs uppercase font-bold text-muted-foreground">{property.propertyType}</TableCell>
                                    <TableCell className="text-right pr-6 space-x-2">
                                        <Button size="sm" variant="outline" className="h-8 text-xs font-bold uppercase tracking-widest px-4" onClick={() => handleRestore(property.id, property.address)}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Restore</Button>
                                        <Button size="sm" variant="destructive" className="h-8 text-xs font-bold uppercase tracking-widest px-4" onClick={() => setPropertyToDelete(property)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="grid gap-4 md:hidden">
                        {deletedProperties.map((property) => (
                            <Card key={property.id} className="shadow-none border-muted/60">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-bold">{[property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ')}</CardTitle>
                                    <CardDescription className="text-xs">{`${property.address.city}, ${property.address.postcode}`}</CardDescription>
                                </CardHeader>
                                <CardFooter className="flex flex-col gap-2 pt-0">
                                    <Button size="sm" variant="outline" className="w-full font-bold h-10" onClick={() => handleRestore(property.id, property.address)}><RefreshCw className="mr-2 h-4 w-4" /> Restore Property</Button>
                                    <Button size="sm" variant="destructive" className="w-full font-bold h-10" onClick={() => setPropertyToDelete(property)}><Trash2 className="mr-2 h-4 w-4" /> Permanent Delete</Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </>
                )}
            </CardContent>
        </Card>
        <AlertDialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}>
            <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl">Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription className="text-base font-medium">
                        This will permanently delete the property record at <strong className="text-foreground">{[propertyToDelete?.address.nameOrNumber, propertyToDelete?.address.street].filter(Boolean).join(', ')}</strong>. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3 mt-4">
                    <AlertDialogCancel className="rounded-xl font-bold uppercase text-xs h-11" disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase text-xs h-11 px-8 shadow-lg" onClick={handleDeletePermanently} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Permanent Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
