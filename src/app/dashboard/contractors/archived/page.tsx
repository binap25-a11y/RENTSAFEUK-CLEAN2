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
import { ArrowLeft, RefreshCw, Loader2, Phone, Mail, Trash2 } from 'lucide-react';
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

interface Contractor {
    id: string;
    name: string;
    trade: string;
    phone: string;
    email?: string;
}

export default function ArchivedContractorsPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [contractorToDelete, setContractorToDelete] = useState<Contractor | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const archivedContractorsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // Strictly hierarchical. Redundant ownerId filter removed.
        return query(
            collection(firestore, 'userProfiles', user.uid, 'contractors'),
            where('status', '==', 'Archived')
        );
    }, [firestore, user]);

    const { data: archivedContractors, isLoading, error } = useCollection<Contractor>(archivedContractorsQuery);

    const handleRestore = async (contractorId: string, name: string) => {
        if (!firestore || !user) return;
        try {
            const docRef = doc(firestore, 'userProfiles', user.uid, 'contractors', contractorId);
            await updateDoc(docRef, { status: 'Active' });
            toast({
                title: 'Contractor Restored',
                description: `${name} has been restored to your active directory.`,
            });
        } catch (e) {
            console.error('Error restoring contractor:', e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not restore the contractor. Please try again.',
            });
        }
    };

    const handleDeletePermanently = async () => {
        if (!firestore || !contractorToDelete || !user) return;
        setIsDeleting(true);
        try {
            const docRef = doc(firestore, 'userProfiles', user.uid, 'contractors', contractorToDelete.id);
            await deleteDoc(docRef);
            toast({
                title: 'Contractor Deleted Permanently',
                description: `${contractorToDelete.name} has been removed from your records.`,
            });
        } catch (e) {
            console.error('Error deleting contractor:', e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not permanently delete the contractor. Please try again.',
            });
        } finally {
            setIsDeleting(false);
            setContractorToDelete(null);
        }
    };

  return (
    <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/contractors">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold font-headline">Archived Contractors</h1>
                <p className="text-muted-foreground">
                    Manage contractors that have been removed from your active directory.
                </p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Archived List</CardTitle>
                <CardDescription>Restore records to your directory or remove them permanently from the system.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-center py-10 text-destructive">Error: {error.message}</div>
                ) : !archivedContractors?.length ? (
                     <div className="text-center py-10 text-muted-foreground italic">
                        No archived contractors found.
                    </div>
                ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden rounded-md border md:block overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Name</TableHead>
                                    <TableHead className="font-bold uppercase tracking-wider text-[10px]">Trade</TableHead>
                                    <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {archivedContractors.map((contractor) => (
                                <TableRow key={contractor.id} className="hover:bg-muted/20 transition-colors">
                                    <TableCell className="font-semibold text-sm">{contractor.name}</TableCell>
                                    <TableCell className="text-sm">{contractor.trade}</TableCell>
                                    <TableCell className="text-right pr-6 space-x-2">
                                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleRestore(contractor.id, contractor.name)}>
                                            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Restore
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => setContractorToDelete(contractor)}>
                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid gap-4 md:hidden">
                        {archivedContractors.map((contractor) => (
                            <Card key={contractor.id} className="shadow-none border-muted/60">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-bold">{contractor.name}</CardTitle>
                                    <CardDescription className="text-xs">{contractor.trade}</CardDescription>
                                </CardHeader>
                                {(contractor.phone || contractor.email) && (
                                    <CardContent className="space-y-2 text-xs pt-0 pb-3 border-b border-dashed mb-3">
                                        {contractor.phone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-3 w-3 text-muted-foreground" />
                                            <span>{contractor.phone}</span>
                                        </div>
                                        )}
                                        {contractor.email && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3 w-3 text-muted-foreground" />
                                            <span className='truncate'>{contractor.email}</span>
                                        </div>
                                        )}
                                    </CardContent>
                                )}
                                <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                                    <Button size="sm" variant="outline" className='w-full text-xs h-9' onClick={() => handleRestore(contractor.id, contractor.name)}>
                                        <RefreshCw className="mr-2 h-3.5 w-3.5" /> Restore
                                    </Button>
                                    <Button size="sm" variant="destructive" className='w-full text-xs h-9' onClick={() => setContractorToDelete(contractor)}>
                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </>
                )}
            </CardContent>
        </Card>

        <AlertDialog open={!!contractorToDelete} onOpenChange={(open) => !open && setContractorToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action is permanent and cannot be undone. This will permanently delete the record for {contractorToDelete?.name} from your contractor directory.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleDeletePermanently}
                        disabled={isDeleting}
                    >
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete Permanently
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
