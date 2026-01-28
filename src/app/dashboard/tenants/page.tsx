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
import { PlusCircle, Loader2, Edit, Archive, Search } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
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
  telephone: string;
  propertyId: string;
  ownerId: string;
  status?: string;
}

interface Property {
  id: string;
  address: string;
}

export default function TenantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantToArchive, setTenantToArchive] = useState<Tenant | null>(null);

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
  
  const activeTenants = useMemo(() => tenants?.filter(t => t.status !== 'Archived') ?? [], [tenants]);

  const filteredTenants = useMemo(() => {
    if (!activeTenants) return [];
    if (!searchTerm) return activeTenants;
    return activeTenants.filter(tenant =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeTenants, searchTerm]);

  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop) => {
        acc[prop.id] = prop.address;
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);


  const handleArchiveConfirm = async () => {
    if (!firestore || !tenantToArchive) return;
    try {
      await updateDoc(doc(firestore, 'tenants', tenantToArchive.id), { status: 'Archived' });
      toast({
        title: 'Tenant Archived',
        description: `${tenantToArchive.name} has been moved to the archives.`,
      });
    } catch (e) {
      console.error('Error archiving tenant:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not archive the tenant. Please try again.',
      });
    } finally {
      setTenantToArchive(null);
    }
  };
  
  const isLoading = isLoadingTenants || isLoadingProperties;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Tenants</h1>
            <p className="text-muted-foreground">
              Manage all your tenants in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                  <Link href="/dashboard/tenants/archived">
                      <Archive className="mr-2 h-4 w-4" /> View Archived
                  </Link>
              </Button>
              <Button asChild>
                <Link href="/dashboard/tenants/add">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Tenant
                </Link>
              </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Active Tenants</CardTitle>
            <CardDescription>A list of current tenants associated with your properties.</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="relative w-full max-w-sm mb-4">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                      placeholder="Search by name or email..." 
                      className="pl-8" 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                  />
              </div>
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
                  {!isLoading && !filteredTenants?.length && (
                      <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                              {searchTerm ? `No tenants found for "${searchTerm}".` : 'No active tenants found.'}
                          </TableCell>
                      </TableRow>
                  )}
                  {!isLoading && filteredTenants?.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                          <Link href={`/dashboard/tenants/${tenant.id}`} className="hover:underline">
                              {tenant.name}
                          </Link>
                      </TableCell>
                      <TableCell>{propertyMap[tenant.propertyId] || 'No property assigned'}</TableCell>
                      <TableCell>{tenant.email}</TableCell>
                      <TableCell>{tenant.telephone}</TableCell>
                      <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={`/dashboard/tenants/${tenant.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setTenantToArchive(tenant)}>
                            <Archive className="h-4 w-4" />
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

      <AlertDialog open={!!tenantToArchive} onOpenChange={(open) => !open && setTenantToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive {tenantToArchive?.name}. You can restore them from the archived tenants page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleArchiveConfirm}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
