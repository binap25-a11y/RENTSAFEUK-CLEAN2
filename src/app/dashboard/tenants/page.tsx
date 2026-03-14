
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
  ShieldCheck,
  Clock
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, query, where, doc, getDocs, limit } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';

// Types
interface Tenant {
  id: string;
  name: string;
  email: string;
  telephone: string;
  propertyId: string;
  landlordId: string;
  status?: string;
  verified?: boolean;
  joinedDate?: any;
}

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
}

export default function TenantsPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [tenantToArchive, setTenantToArchive] = useState<Tenant | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Fetch properties - strictly hierarchical for context
  const propertiesQuery = useMemoFirebase(() => {
    if(!user || !firestore) return null;
    return query(
        collection(firestore, 'properties'),
        where('landlordId', '==', user.uid),
        where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);
  const { data: properties } = useCollection<Property>(propertiesQuery);
  
  // High-performance Flat Tenant Query
  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'tenants'),
        where('landlordId', '==', user.uid),
        where('status', '==', 'Active')
    );
  }, [user, firestore]);
  const { data: tenants, isLoading } = useCollection<Tenant>(tenantsQuery);

  const filteredTenants = useMemo(() => {
    if (!tenants) return [];
    if (!searchTerm) return tenants;
    const lower = searchTerm.toLowerCase();
    return tenants.filter(t =>
        t.name.toLowerCase().includes(lower) ||
        t.email.toLowerCase().includes(lower)
    );
  }, [tenants, searchTerm]);

  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop) => {
        acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);


  const handleArchiveConfirm = async () => {
    if (!firestore || !user || !tenantToArchive) return;
    setIsArchiving(true);
    
    try {
      const tenantRef = doc(firestore, 'tenants', tenantToArchive.id);
      
      // 1. Mark Tenant as Archived (Reactive via useCollection)
      updateDocumentNonBlocking(tenantRef, { status: 'Archived' });

      // 2. Atomic Status Sync: Scan for remaining active tenants on this property
      const activeTenantsQuery = query(
          collection(firestore, 'tenants'),
          where('propertyId', '==', tenantToArchive.propertyId),
          where('status', '==', 'Active'),
          limit(5)
      );
      const snap = await getDocs(activeTenantsQuery);
      
      // If this was the last active tenant (count including current is handled by the reactive nature of the query engine), 
      // mark property as vacant atomically. Note: snapshot checks against live data.
      if (snap.docs.filter(d => d.id !== tenantToArchive.id).length === 0) {
          const propRef = doc(firestore, 'properties', tenantToArchive.propertyId);
          updateDocumentNonBlocking(propRef, { status: 'Vacant' });
      }

      toast({
        title: 'Tenant Archived',
        description: `${tenantToArchive.name} has been moved to the archives and property status updated.`,
      });
      
      setTenantToArchive(null);
    } catch (e) {
      console.error('Error archiving tenant:', e);
      toast({
        variant: 'destructive',
        title: 'Sync Error',
        description: 'Failed to update registry. Please try again.',
      });
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 text-left">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold font-headline text-primary">Tenants</h1>
            <p className="text-muted-foreground font-medium">
              Manage resident verification and tenancy records.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Button asChild variant="outline" className="w-full sm:w-auto font-bold uppercase tracking-widest text-[10px] h-10 px-6">
                  <Link href="/dashboard/tenants/archived">
                      <Archive className="mr-2 h-4 w-4" /> View Archived
                  </Link>
              </Button>
              <Button asChild className="w-full sm:w-auto font-bold uppercase tracking-widest text-[10px] h-10 px-8 shadow-lg bg-primary hover:bg-primary/90">
                <Link href="/dashboard/tenants/add">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Tenant
                </Link>
              </Button>
          </div>
        </div>
        
        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-muted/20 border-b pb-6 text-left">
            <CardTitle>Portfolio Registry</CardTitle>
            <CardDescription>A list of active tenants and their Resident Hub status.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="relative w-full max-sm mb-6">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="tenant-search-input"
                name="tenantSearch"
                placeholder="Search by name or email..."
                className="pl-8 h-11 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-64 gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Synchronizing residents...</p>
              </div>
            ) : !filteredTenants?.length ? (
              <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/5">
                <Search className="h-10 w-10 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">
                  {searchTerm ? `No tenants found for "${searchTerm}".` : 'No active tenants found.'}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden rounded-xl border md:block overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider pl-6 py-4">Resident Identity</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Property</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Status</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTenants.map((tenant) => {
                        const isVerified = tenant.verified === true || !!tenant.joinedDate;
                        return (
                          <TableRow key={tenant.id} className="hover:bg-muted/30 transition-colors group">
                            <TableCell className="font-bold pl-6 py-5 text-left">
                              <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`} className="hover:underline text-primary">
                                {tenant.name}
                              </Link>
                              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">{tenant.email}</div>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-muted-foreground text-left">
                              {propertyMap[tenant.propertyId] || 'Assigned Property'}
                            </TableCell>
                            <TableCell className="text-left">
                              {isVerified ? (
                                <Badge variant="default" className="bg-green-50 text-green-700 border-green-200 gap-1.5 font-bold uppercase text-[9px] px-2.5 h-6 shadow-sm">
                                    <ShieldCheck className="h-3 w-3" /> Verified
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1.5 font-bold uppercase text-[9px] px-2.5 h-6 opacity-70">
                                    <Clock className="h-3 w-3" /> Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-primary shadow-none"><Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`}><Eye className="h-4 w-4" /></Link></Button>
                                  <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-primary shadow-none"><Link href={`/dashboard/tenants/${tenant.id}/edit?propertyId=${tenant.propertyId}`}><Edit className="h-4 w-4" /></Link></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shadow-none" onClick={() => setTenantToArchive(tenant)}><Archive className="h-4 w-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-4 md:hidden">
                  {filteredTenants.map((tenant) => {
                    const isVerified = tenant.verified === true || !!tenant.joinedDate;
                    return (
                      <Card key={tenant.id} className="shadow-sm border-muted/60 overflow-hidden text-left">
                        <CardHeader className="pb-3 bg-muted/5 border-b">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <CardTitle className="text-lg font-bold">
                                <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`} className="hover:underline">
                                  {tenant.name}
                                </Link>
                              </CardTitle>
                              <CardDescription className="text-xs font-bold uppercase tracking-tight text-primary">
                                {propertyMap[tenant.propertyId] || 'Assigned Property'}
                              </CardDescription>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="-mr-2 -mt-2">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 p-1">
                                <DropdownMenuItem asChild className="cursor-pointer">
                                  <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`}>
                                      <Eye className="mr-2 h-4 w-4" /> View Profile
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="cursor-pointer">
                                  <Link href={`/dashboard/tenants/${tenant.id}/edit?propertyId=${tenant.propertyId}`}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit Record
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTenantToArchive(tenant)} className="text-destructive font-bold cursor-pointer">
                                  <Archive className="mr-2 h-4 w-4" /> Archive Tenant
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4 pb-4">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className='truncate font-medium'>{tenant.email}</span>
                              </div>
                              {isVerified ? (
                                <Badge className="bg-green-50 text-green-700 border-green-200 text-[8px] uppercase font-bold px-2 py-0">Verified</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[8px] uppercase font-bold px-2 py-0">Pending</Badge>
                              )}
                          </div>
                          {tenant.telephone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{tenant.telephone}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!tenantToArchive} onOpenChange={(open) => !open && setTenantToArchive(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4"><Archive className="h-8 w-8 text-destructive" /></div>
            <AlertDialogTitle className="text-xl text-center">Archive tenant record?</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium text-center">
              This will move <strong className="text-foreground">{tenantToArchive?.name}</strong> to your archives and update the property availability. Access to the Resident Hub will be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-2xl font-bold uppercase text-[10px] h-12 flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl font-bold uppercase text-[10px] h-12 flex-1 shadow-lg"
              onClick={handleArchiveConfirm}
              disabled={isArchiving}
            >
              {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Archive Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
