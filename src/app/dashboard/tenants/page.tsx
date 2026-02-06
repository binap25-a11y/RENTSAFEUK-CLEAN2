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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PlusCircle,
  Loader2,
  Edit,
  Archive,
  Search,
  MoreVertical,
  Mail,
  Phone,
} from 'lucide-react';
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
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
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
      where('ownerId', '==', user.uid),
      where('status', '==', 'Active')
    );
  }, [firestore, user]);
  const { data: activeTenants, isLoading: isLoadingTenants, error: tenantsError } = useCollection<Tenant>(tenantsQuery);
  
  // Fetch properties to map propertyId to address
  const propertiesQuery = useMemoFirebase(() => {
    if(!user) return null;
    return query(
        collection(firestore, 'properties'),
        where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
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
        acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);


  const handleArchiveConfirm = async () => {
    if (!firestore || !user || !tenantToArchive) return;
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
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Tenants</h1>
            <p className="text-muted-foreground">
              Manage all your tenants in one place.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/dashboard/tenants/archived">
                      <Archive className="mr-2 h-4 w-4" /> View Archived
                  </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
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
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tenantsError ? (
              <div className="text-center py-10 text-destructive">Error: {tenantsError.message}</div>
            ) : !filteredTenants?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                {searchTerm ? `No tenants found for "${searchTerm}".` : 'No active tenants found.'}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden rounded-md border md:block">
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
                      {filteredTenants.map((tenant) => (
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

                {/* Mobile Card View */}
                <div className="grid gap-4 md:hidden">
                  {filteredTenants.map((tenant) => (
                    <Card key={tenant.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">
                              <Link href={`/dashboard/tenants/${tenant.id}`} className="hover:underline">
                                {tenant.name}
                              </Link>
                            </CardTitle>
                            <CardDescription>
                              {propertyMap[tenant.propertyId] || 'No property assigned'}
                            </CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="-mr-2 -mt-2">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/tenants/${tenant.id}/edit`}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTenantToArchive(tenant)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                <Archive className="mr-2 h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${tenant.email}`} className='truncate hover:underline'>{tenant.email}</a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{tenant.telephone}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
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
