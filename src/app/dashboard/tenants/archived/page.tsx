
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { ArrowLeft, RefreshCw, Loader2, Mail, Phone, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

interface Tenant {
  id: string;
  name: string;
  email: string;
  telephone?: string;
  propertyId: string;
  status?: string;
}

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
}

export default function ArchivedTenantsPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

    const propertiesQuery = useMemoFirebase(() => {
        if(!user || !firestore) return null;
        return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid));
      }, [firestore, user]);
    const { data: properties } = useCollection<Property>(propertiesQuery);
    
    const tenantsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'tenants'),
            where('landlordId', '==', user.uid),
            where('status', '==', 'Archived')
        );
    }, [user, firestore]);
    const { data: archivedTenants, isLoading } = useCollection<Tenant>(tenantsQuery);

    const propertyMap = useMemo(() => {
        if (!properties) return {};
        return properties.reduce((acc, prop) => {
            acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
            return acc;
        }, {} as Record<string, string>);
    }, [properties]);

    const handleRestore = async (tenantId: string, tenantName: string) => {
        if (!firestore || !user) return;
        try {
            const docRef = doc(firestore, 'tenants', tenantId);
            await updateDoc(docRef, { status: 'Active' });
            toast({
                title: 'Tenant Restored',
                description: `${tenantName} has been restored to your active tenants list.`,
            });
        } catch (e) {
            console.error('Error restoring tenant:', e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not restore the tenant. Please try again.',
            });
        }
    };

    const handleDeletePermanently = async () => {
        if (!firestore || !user || !tenantToDelete) return;
        try {
            const docRef = doc(firestore, 'tenants', tenantToDelete.id);
            await deleteDoc(docRef);
            toast({
                title: 'Tenant Permanently Deleted',
                description: `${tenantToDelete.name} has been removed from the database. This action cannot be undone.`,
            });
        } catch (e) {
            console.error('Error deleting tenant permanently:', e);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not permanently delete the tenant. Please try again.',
            });
        } finally {
            setTenantToDelete(null);
        }
    };

  return (
    <>
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/tenants">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Archived Tenants</h1>
                    <p className="text-muted-foreground">
                        A list of past tenants across your portfolio.
                    </p>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Archived Records</CardTitle>
                    <CardDescription>You can restore tenants to your active list or delete them permanently.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !archivedTenants?.length ? (
                        <div className="text-center py-10 text-muted-foreground italic">
                            No archived tenants found.
                        </div>
                    ) : (
                    <>
                        <div className="hidden rounded-md border md:block overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Name</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Email</TableHead>
                                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Last Known Property</TableHead>
                                        <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {archivedTenants.map((tenant) => (
                                    <TableRow key={tenant.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell className="font-medium">{tenant.name}</TableCell>
                                        <TableCell className="text-xs">{tenant.email}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{propertyMap[tenant.propertyId] || 'N/A'}</TableCell>
                                        <TableCell className="text-right pr-6 space-x-2">
                                            <Button size="sm" variant="outline" className="h-8 text-xs px-4" onClick={() => handleRestore(tenant.id, tenant.name)}>
                                                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Restore
                                            </Button>
                                            <Button size="sm" variant="destructive" className="h-8 text-xs px-4" onClick={() => setTenantToDelete(tenant)}>
                                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="grid gap-4 md:hidden">
                            {archivedTenants.map((tenant) => (
                                <Card key={tenant.id} className="shadow-none border-muted/60">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-bold">{tenant.name}</CardTitle>
                                        <CardDescription className="text-xs font-medium">{propertyMap[tenant.propertyId] || 'No property assigned'}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-xs pt-0 pb-3 border-b border-dashed mb-3">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className='truncate'>{tenant.email}</span>
                                        </div>
                                        {tenant.telephone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                <span>{tenant.telephone}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                                        <Button size="sm" variant="outline" className="h-9 font-bold" onClick={() => handleRestore(tenant.id, tenant.name)}>
                                            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Restore
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-9 font-bold" onClick={() => setTenantToDelete(tenant)}>
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
        </div>
        
        <AlertDialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
            <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                <AlertDialogTitle className="text-xl">Permanent Deletion</AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium">
                    This action is permanent. This will completely remove the tenant record for <strong className="text-foreground">{tenantToDelete?.name}</strong> from your history.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl font-bold uppercase text-xs h-11">Cancel</AlertDialogCancel>
                <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase text-xs h-11 px-8 shadow-lg"
                    onClick={handleDeletePermanently}
                >
                    Delete Permanently
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
