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
import { query, where, doc, updateDoc, deleteDoc, collectionGroup } from 'firebase/firestore';
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

// Types
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
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);

    const tenantsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collectionGroup(firestore, 'tenants'),
            where('ownerId', '==', user.uid),
            where('status', '==', 'Archived')
        );
    }, [firestore, user]);
    const { data: archivedTenants, isLoading: isLoadingTenants, error } = useCollection<Tenant>(tenantsQuery);

     const propertiesQuery = useMemoFirebase(() => {
        if(!user || !firestore) return null;
        return query(
            collectionGroup(firestore, 'properties'),
            where('ownerId', '==', user.uid)
        );
      }, [firestore, user]);
    const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
    
    const propertyMap = useMemo(() => {
        if (!properties) return {};
        return properties.reduce((acc, prop) => {
            acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
            return acc;
        }, {} as Record<string, string>);
    }, [properties]);

    const handleRestore = async (tenantId: string, tenantName: string, propertyId: string) => {
        if (!firestore || !user) return;
        try {
            const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId);
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
            const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', tenantToDelete.propertyId, 'tenants', tenantToDelete.id);
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
    
    const isLoading = isLoadingTenants || isLoadingProperties;

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
                        A list of past tenants.
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
                    ) : error ? (
                        <div className="text-center py-10 text-destructive">Error: {error.message}</div>
                    ) : !archivedTenants?.length ? (
                        <div className="text-center py-10 text-muted-foreground">
                            No archived tenants found.
                        </div>
                    ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden rounded-md border md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Last Known Property</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {archivedTenants.map((tenant) => (
                                    <TableRow key={tenant.id}>
                                        <TableCell className="font-medium">{tenant.name}</TableCell>
                                        <TableCell>{tenant.email}</TableCell>
                                        <TableCell>{propertyMap[tenant.propertyId] || 'N/A'}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button size="sm" variant="outline" className="w-28 justify-center" onClick={() => handleRestore(tenant.id, tenant.name, tenant.propertyId)}>
                                                <RefreshCw className="mr-2 h-4 w-4" /> Restore
                                            </Button>
                                            <Button size="sm" variant="destructive" className="w-28 justify-center" onClick={() => setTenantToDelete(tenant)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="grid gap-4 md:hidden">
                            {archivedTenants.map((tenant) => (
                                <Card key={tenant.id}>
                                    <CardHeader>
                                        <CardTitle className="text-base">{tenant.name}</CardTitle>
                                        <CardDescription>{propertyMap[tenant.propertyId] || 'No property assigned'}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm pt-0">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <a href={`mailto:${tenant.email}`} className='truncate hover:underline'>{tenant.email}</a>
                                        </div>
                                        {tenant.telephone && (
                                            <div className="flex items-center gap-2">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                <span>{tenant.telephone}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="grid grid-cols-2 gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleRestore(tenant.id, tenant.name, tenant.propertyId)}>
                                            <RefreshCw className="mr-2 h-4 w-4" /> Restore
                                        </Button>
                                        <Button size="sm" variant="destructive" onClick={() => setTenantToDelete(tenant)}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action is permanent and cannot be undone. This will permanently delete the tenant record for {tenantToDelete?.name}. Associated data like screening reports will not be deleted but may become inaccessible.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
