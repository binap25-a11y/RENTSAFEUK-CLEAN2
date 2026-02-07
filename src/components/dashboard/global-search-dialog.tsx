'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Home, Users, HardHat, Wrench, CalendarCheck, Loader2, Search } from 'lucide-react';

// Data types
interface Searchable {
  id: string;
  [key: string]: any;
}
interface Property extends Searchable {
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
  status?: string;
}
interface Tenant extends Searchable { name: string; email: string; status?: string; }
interface Contractor extends Searchable { name: string; trade: string; status?: string; }
interface MaintenanceLog extends Searchable { title: string; propertyId: string; }
interface Inspection extends Searchable { type: string; propertyId: string; }

// Result group type
interface SearchResultGroup {
  title: string;
  icon: React.ElementType;
  items: {
    id: string;
    title: string;
    description: string;
    href: string;
  }[];
}

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ isOpen, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allData, setAllData] = useState<{
    properties: Property[];
    tenants: Tenant[];
    contractors: Contractor[];
    maintenanceLogs: MaintenanceLog[];
    inspections: Inspection[];
  } | null>(null);

  useEffect(() => {
    if (isOpen && !allData && user && firestore) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // Fetch top-level collections
          const propertyQuery = query(collection(firestore, 'properties'), where('ownerId', '==', user.uid));
          const tenantQuery = query(collection(firestore, 'tenants'), where('ownerId', '==', user.uid));
          const contractorQuery = query(collection(firestore, 'contractors'), where('ownerId', '==', user.uid));
          
          const [propertySnap, tenantSnap, contractorSnap] = await Promise.all([
            getDocs(propertyQuery),
            getDocs(tenantQuery),
            getDocs(contractorSnap),
          ]);
          
          const properties = propertySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
          const tenants = tenantSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
          const contractors = contractorSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contractor));
          
          // Fetch sub-collections for each property
          const maintenanceLogs: MaintenanceLog[] = [];
          const inspections: Inspection[] = [];

          for (const prop of properties) {
              const maintenanceQuery = query(collection(firestore, 'properties', prop.id, 'maintenanceLogs'));
              const inspectionQuery = query(collection(firestore, 'properties', prop.id, 'inspections'));

              const [maintenanceSnap, inspectionSnap] = await Promise.all([
                  getDocs(maintenanceQuery),
                  getDocs(inspectionQuery),
              ]);

              maintenanceSnap.docs.forEach(doc => maintenanceLogs.push({ id: doc.id, ...doc.data(), propertyId: prop.id } as MaintenanceLog));
              inspectionSnap.docs.forEach(doc => inspections.push({ id: doc.id, ...doc.data(), propertyId: prop.id } as Inspection));
          }
          
          setAllData({ properties, tenants, contractors, maintenanceLogs, inspections });

        } catch (error) {
          console.error("Failed to fetch search data:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, allData, user, firestore]);

  const searchResults = useMemo((): SearchResultGroup[] => {
    if (!searchTerm || !allData) {
      return [];
    }
    const term = searchTerm.toLowerCase();
    const results: SearchResultGroup[] = [];

    const formatAddress = (address: Property['address']) => {
        if (!address) return 'Unknown Property';
        return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
    }

    // Search Properties
    const propertyItems = allData.properties
      .filter(p => p.status !== 'Deleted' && formatAddress(p.address).toLowerCase().includes(term))
      .map(p => ({
        id: p.id,
        title: formatAddress(p.address),
        description: 'Property',
        href: `/dashboard/properties/${p.id}`,
      }));
    if (propertyItems.length) results.push({ title: 'Properties', icon: Home, items: propertyItems });

    // Search Tenants
    const tenantItems = allData.tenants
      .filter(t => t.name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term))
      .map(t => ({
        id: t.id,
        title: t.name,
        description: t.status === 'Archived' ? 'Archived Tenant' : 'Tenant',
        href: `/dashboard/tenants/${t.id}`,
      }));
    if (tenantItems.length) results.push({ title: 'Tenants', icon: Users, items: tenantItems });
    
    // Search Contractors
    const contractorItems = allData.contractors
      .filter(c => c.name.toLowerCase().includes(term) || c.trade.toLowerCase().includes(term))
      .map(c => ({
        id: c.id,
        title: c.name,
        description: c.status === 'Archived' ? 'Archived Contractor' : 'Contractor',
        href: `/dashboard/contractors/${c.id}/edit`,
      }));
    if (contractorItems.length) results.push({ title: 'Contractors', icon: HardHat, items: contractorItems });

    // Search Maintenance Logs
    const maintenanceItems = allData.maintenanceLogs
      .filter(m => m.title.toLowerCase().includes(term))
      .map(m => ({
        id: m.id,
        title: m.title,
        description: 'Maintenance Log',
        href: `/dashboard/maintenance/${m.id}?propertyId=${m.propertyId}`,
      }));
    if (maintenanceItems.length) results.push({ title: 'Maintenance', icon: Wrench, items: maintenanceItems });
    
    // Search Inspections
    const inspectionItems = allData.inspections
      .filter(i => (i.type || '').toLowerCase().includes(term))
      .map(i => ({
        id: i.id,
        title: `${i.type} Inspection`,
        description: 'Inspection Record',
        href: `/dashboard/inspections/${i.id}?propertyId=${i.propertyId}`,
      }));
    if (inspectionItems.length) results.push({ title: 'Inspections', icon: CalendarCheck, items: inspectionItems });

    return results;

  }, [searchTerm, allData]);

  const handleSelect = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setSearchTerm('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) setSearchTerm('');
    }}>
      <DialogContent className="p-0 gap-0 max-w-3xl overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Global Search</DialogTitle>
          <DialogDescription>Search properties, tenants, contractors, and maintenance tasks across your portfolio.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center px-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search everything..."
            className="flex-1 h-14 text-lg bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <div className="p-2 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
                <div className="flex flex-col justify-center items-center h-48 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Indexing portfolio...</p>
                </div>
            ) : searchTerm && !searchResults.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="h-12 w-12 text-muted-foreground/20 mb-4" />
                    <p className="text-lg font-medium">No results found</p>
                    <p className="text-sm text-muted-foreground">We couldn't find anything matching "{searchTerm}"</p>
                </div>
            ) : !searchTerm ? (
                <div className="p-6">
                    <h2 className="text-sm font-semibold mb-4">
                        Quick Search
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Properties</p>
                            <p className="text-sm">Find any property by street name, city, or postcode.</p>
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Tenants</p>
                            <p className="text-sm">Search by name or email to view contact info and documents.</p>
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Maintenance</p>
                            <p className="text-sm">Find specific repairs or maintenance logs by title.</p>
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/30">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Contractors</p>
                            <p className="text-sm">Quickly access your directory of saved tradespeople.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 p-2">
                    {searchResults.map((group) => (
                        <div key={group.title}>
                            <h3 className="text-[10px] font-bold text-muted-foreground px-3 mb-2 uppercase tracking-widest">{group.title}</h3>
                            <ul className="space-y-1">
                                {group.items.map(item => (
                                    <li
                                        key={item.id}
                                        className="p-3 rounded-xl hover:bg-accent cursor-pointer group transition-all"
                                        onClick={() => handleSelect(item.href)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                                <group.icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm truncate">{item.title}</p>
                                                <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className="p-3 border-t bg-muted/20 flex justify-end items-center text-[10px] text-muted-foreground uppercase tracking-tighter">
            <div className="font-bold text-primary/60">RentSafeUK Search</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
