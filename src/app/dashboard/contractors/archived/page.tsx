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
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';

interface Contractor {
    id: string;
    name: string;
    trade: string;
}

export default function ArchivedContractorsPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const archivedContractorsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'contractors'),
            where('ownerId', '==', user.uid),
            where('status', '==', 'Archived')
        );
    }, [firestore, user]);

    const { data: archivedContractors, isLoading, error } = useCollection<Contractor>(archivedContractorsQuery);

    const handleRestore = async (contractorId: string, name: string) => {
        if (!firestore) return;
        try {
            const docRef = doc(firestore, 'contractors', contractorId);
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

  return (
    <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/contractors">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold">Archived Contractors</h1>
                <p className="text-muted-foreground">
                    A list of contractors that have been archived.
                </p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Archived Contractors</CardTitle>
                <CardDescription>You can restore these contractors to your active directory.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : error ? (
                    <div className="text-center py-10 text-destructive">Error: {error.message}</div>
                ) : !archivedContractors?.length ? (
                     <div className="text-center py-10 text-muted-foreground">
                        No archived contractors.
                    </div>
                ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden rounded-md border md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Trade</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {archivedContractors.map((contractor) => (
                                <TableRow key={contractor.id}>
                                    <TableCell className="font-medium">{contractor.name}</TableCell>
                                    <TableCell>{contractor.trade}</TableCell>
                                    <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleRestore(contractor.id, contractor.name)}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Restore
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
                            <Card key={contractor.id}>
                                <CardHeader>
                                    <CardTitle className='text-base'>{contractor.name}</CardTitle>
                                    <CardDescription>{contractor.trade}</CardDescription>
                                </CardHeader>
                                <CardFooter>
                                    <Button size="sm" className='w-full' onClick={() => handleRestore(contractor.id, contractor.name)}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Restore
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
