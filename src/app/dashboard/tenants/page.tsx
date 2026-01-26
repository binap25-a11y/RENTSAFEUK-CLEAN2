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
import { PlusCircle, Loader2, Edit, Trash2 } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, deleteDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';

// Types
interface Tenant {
  id: string;
  name: string;
  email: string;
  telephone: string;
  propertyId: string;
  ownerId: string;
}

interface Property {
  id: string;
  address: string;
}

export default function TenantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch tenants
  const tenantsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'tenants'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: tenants, isLoading: isLoadingTenants, error: tenantsError } = useCollection<Tenant>(tenantsQuery);
  
  // Fetch properties to map propertyId to address
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


  const handleDelete = async (tenantId: string, tenantName: string) => {
    if (!firestore) return;
    const isConfirmed = confirm(`Are you sure you want to delete the tenant ${tenantName}? This action cannot be undone.`);
    if (isConfirmed) {
      try {
        await deleteDoc(doc(firestore, 'tenants', tenantId));
        toast({
          title: 'Tenant Deleted',
          description: `${tenantName} has been removed from your records.`,
        });
      } catch (e) {
        console.error('Error deleting tenant:', e);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not delete the tenant. Please try again.',
        });
      }
    }
  };
  
  const isLoading = isLoadingTenants || isLoadingProperties;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">
            Manage all your tenants in one place.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tenants/add">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Tenant
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
          <CardDescription>A list of current and past tenants associated with your properties.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telephone</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                    </TableRow>
                )}
                {!isLoading && tenantsError && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-destructive">
                            Error: {tenantsError.message}
                        </TableCell>
                    </TableRow>
                )}
                {!isLoading && !tenants?.length && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            No tenants found.
                        </TableCell>
                    </TableRow>
                )}
                {!isLoading && tenants?.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{propertyMap[tenant.propertyId] || 'No property assigned'}</TableCell>
                    <TableCell>{tenant.email}</TableCell>
                    <TableCell>{tenant.telephone}</TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" disabled>
                           <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tenant.id, tenant.name)}>
                           <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
