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
            getDocs(contractorQuery),
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
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Global Search</DialogTitle>
          <DialogDescription>Search properties, tenants, contractors, and maintenance tasks across your portfolio.</DialogDescription>
        </DialogHeader>
        <div className="p-4 border-b">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search properties, tenants, or tasks..."
                className="pl-9 h-11 text-base bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
                <div className="flex justify-center items-center h-24">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : searchTerm && !searchResults.length ? (
                <p className="text-center text-muted-foreground py-6">No results found for "{searchTerm}".</p>
            ) : !searchTerm ? (
                <div className="text-center py-6">
                    <p className="text-muted-foreground mb-2 text-sm">Start typing to search your entire portfolio.</p>
                    <div className="flex justify-center gap-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                        <span className="flex items-center gap-1"><Home className="h-3 w-3"/> Properties</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3"/> Tenants</span>
                        <span className="flex items-center gap-1"><Wrench className="h-3 w-3"/> Maintenance</span>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {searchResults.map((group) => (
                        <div key={group.title}>
                            <h3 className="text-xs font-semibold text-muted-foreground px-2 mb-2">{group.title}</h3>
                            <ul className="space-y-1">
                                {group.items.map(item => (
                                    <li
                                        key={item.id}
                                        className="p-2 rounded-md hover:bg-accent cursor-pointer group transition-colors"
                                        onClick={() => handleSelect(item.href)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded bg-muted group-hover:bg-background transition-colors">
                                                <group.icon className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{item.title}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-tight">{item.description}</p>
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
      </DialogContent>
    </Dialog>
  );
}
