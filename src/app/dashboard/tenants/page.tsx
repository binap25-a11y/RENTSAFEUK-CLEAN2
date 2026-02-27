'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  Eye,
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useMemo, useState, useEffect } from 'react';
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
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantToArchive, setTenantToArchive] = useState<Tenant | null>(null);
  const [portfolioTenants, setPortfolioTenants] = useState<Tenant[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);

  // Fetch properties - strictly hierarchical
  const propertiesQuery = useMemoFirebase(() => {
    if(!user || !firestore) return null;
    return query(
        collection(firestore, 'userProfiles', user.uid, 'properties'),
        where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  // Aggregated Tenants Listener - Fetches from secure nested property paths
  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) {
        setPortfolioTenants([]);
        return;
    }

    setIsAggregating(true);
    const unsubs: (() => void)[] = [];
    const tenantsMap: Record<string, Tenant[]> = {};

    const updateState = () => {
        setPortfolioTenants(Object.values(tenantsMap).flat().filter(t => t.status === 'Active'));
        setIsAggregating(false);
    };

    properties.forEach(p => {
        const q = collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'tenants');
        unsubs.push(onSnapshot(q, (snap) => {
            tenantsMap[p.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));
            updateState();
        }));
    });

    return () => unsubs.forEach(u => u());
  }, [user, properties, firestore]);

  const filteredTenants = useMemo(() => {
    if (!portfolioTenants) return [];
    if (!searchTerm) return portfolioTenants;
    return portfolioTenants.filter(tenant =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [portfolioTenants, searchTerm]);

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
      const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', tenantToArchive.propertyId, 'tenants', tenantToArchive.id);
      await updateDoc(docRef, { status: 'Archived' });
      toast({
        title: 'Tenant Archived',
        description: `${tenantToArchive.name} has been moved to the archives.`,
      });
    } catch (e) {
      console.error('Error archiving tenant:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not archive the tenant.',
      });
    } finally {
      setTenantToArchive(null);
    }
  };
  
  const isLoading = isLoadingProperties || isAggregating;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold font-headline">Tenants</h1>
            <p className="text-muted-foreground font-medium">
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
        
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle>Active Tenants</CardTitle>
            <CardDescription>A list of current tenants associated with your properties.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full max-w-sm mb-6">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                className="pl-8 h-11"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-64 gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading tenants...</p>
              </div>
            ) : !filteredTenants?.length ? (
              <div className="text-center py-20 border-2 border-dashed rounded-xl bg-muted/5">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">
                  {searchTerm ? `No tenants found for "${searchTerm}".` : 'No active tenants found.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden rounded-md border md:block overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Name</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Property</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Contact</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((tenant) => (
                        <TableRow key={tenant.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold">
                            <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`} className="hover:underline text-primary">
                              {tenant.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {propertyMap[tenant.propertyId] || 'Assigned Property'}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                                <p className="text-xs font-semibold">{tenant.email}</p>
                                <p className="text-[10px] text-muted-foreground">{tenant.telephone}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                    <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`}>
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                    <Link href={`/dashboard/tenants/${tenant.id}/edit?propertyId=${tenant.propertyId}`}>
                                        <Edit className="mr-2 h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setTenantToArchive(tenant)}>
                                    <Archive className="h-4 w-4" />
                                </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-4 md:hidden">
                  {filteredTenants.map((tenant) => (
                    <Card key={tenant.id} className="shadow-sm border-muted/60">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-bold">
                              <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`} className="hover:underline">
                                {tenant.name}
                              </Link>
                            </CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-tight mt-1 text-primary">
                              {propertyMap[tenant.propertyId] || 'Assigned Property'}
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
                                <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`}>
                                    <Eye className="mr-2 h-4 w-4" /> View Profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/tenants/${tenant.id}/edit?propertyId=${tenant.propertyId}`}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setTenantToArchive(tenant)} className="text-destructive">
                                <Archive className="mr-2 h-4 w-4" /> Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm pt-0 pb-4 border-b border-dashed">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className='truncate font-medium'>{tenant.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{tenant.telephone}</span>
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
            <AlertDialogTitle>Archive tenant record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {tenantToArchive?.name} to the archives. You can restore them later from the archived tenants page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleArchiveConfirm}
            >
              Archive Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
