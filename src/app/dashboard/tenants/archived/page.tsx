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
import { ArrowLeft, RefreshCw, Loader2, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useMemo } from 'react';

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
  address: string;
}

export default function ArchivedTenantsPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const tenantsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'tenants'),
            where('ownerId', '==', user.uid),
            where('status', '==', 'Archived')
        );
    }, [firestore, user]);
    const { data: archivedTenants, isLoading: isLoadingTenants, error } = useCollection<Tenant>(tenantsQuery);

     const propertiesQuery = useMemoFirebase(() => {
        if(!user) return null;
        return query(
            collection(firestore, 'properties'),
            where('ownerId', '==', user.uid)
        );
      }, [firestore, user]);
    const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
    
    const propertyMap = useMemo(() => {
        if (!properties) return {};
        return properties.reduce((acc, prop) => {
            acc[prop.id] = prop.address;
            return acc;
        }, {} as Record<string, string>);
    }, [properties]);

    const handleRestore = async (tenantId: string, tenantName: string) => {
        if (!firestore) return;
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
    
    const isLoading = isLoadingTenants || isLoadingProperties;

  return (
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
                <CardDescription>You can restore these tenants to your active list.</CardDescription>
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
                                    <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleRestore(tenant.id, tenant.name)}>
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
                        {archivedTenants.map((tenant) => (
                            <Card key={tenant.id}>
                                <CardHeader>
                                    <CardTitle>{tenant.name}</CardTitle>
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
                                <CardFooter>
                                    <Button size="sm" className="w-full" onClick={() => handleRestore(tenant.id, tenant.name)}>
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
