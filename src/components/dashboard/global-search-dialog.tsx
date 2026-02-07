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
import { collection, query, where, getDocs, collectionGroup, limit } from 'firebase/firestore';
import { Home, Users, HardHat, Wrench, CalendarCheck, Loader2, Search } from 'lucide-react';

// Data types
interface Searchable {
  id: string;
  [key: string]: any;
}
interface Property extends Searchable {
  address: { nameOrNumber?: string; street: string; city: string; postcode: string; };
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

  // Load data efficiently when search is opened
  useEffect(() => {
    if (isOpen && !allData && user && firestore) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const ownerFilter = where('ownerId', '==', user.uid);
          
          // Use parallel collection group queries for high speed
          const queries = [
            getDocs(query(collection(firestore, 'properties'), ownerFilter)),
            getDocs(query(collection(firestore, 'tenants'), ownerFilter)),
            getDocs(query(collection(firestore, 'contractors'), ownerFilter)),
            getDocs(query(collectionGroup(firestore, 'maintenanceLogs'), ownerFilter, limit(100))),
            getDocs(query(collectionGroup(firestore, 'inspections'), ownerFilter, limit(100))),
          ];
          
          const [propSnap, tenantSnap, contractorSnap, maintSnap, inspSnap] = await Promise.all(queries);
          
          setAllData({
            properties: propSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property)),
            tenants: tenantSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)),
            contractors: contractorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Contractor)),
            maintenanceLogs: maintSnap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)),
            inspections: inspSnap.docs.map(d => ({ id: d.id, ...d.data() } as Inspection)),
          });
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
    if (!searchTerm || !allData) return [];
    const term = searchTerm.toLowerCase();
    const results: SearchResultGroup[] = [];

    const formatAddress = (address: Property['address']) => {
        if (!address) return 'Unknown Property';
        return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
    }

    // Properties
    const propertyItems = allData.properties
      .filter(p => p.status !== 'Deleted' && formatAddress(p.address).toLowerCase().includes(term))
      .map(p => ({ id: p.id, title: formatAddress(p.address), description: 'Property', href: `/dashboard/properties/${p.id}` }));
    if (propertyItems.length) results.push({ title: 'Properties', icon: Home, items: propertyItems.slice(0, 5) });

    // Tenants
    const tenantItems = allData.tenants
      .filter(t => t.name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term))
      .map(t => ({ id: t.id, title: t.name, description: t.status === 'Archived' ? 'Archived Tenant' : 'Tenant', href: `/dashboard/tenants/${t.id}` }));
    if (tenantItems.length) results.push({ title: 'Tenants', icon: Users, items: tenantItems.slice(0, 5) });
    
    // Contractors
    const contractorItems = allData.contractors
      .filter(c => c.name.toLowerCase().includes(term) || c.trade.toLowerCase().includes(term))
      .map(c => ({ id: c.id, title: c.name, description: 'Contractor', href: `/dashboard/contractors/${c.id}/edit` }));
    if (contractorItems.length) results.push({ title: 'Contractors', icon: HardHat, items: contractorItems.slice(0, 5) });

    // Maintenance
    const maintenanceItems = allData.maintenanceLogs
      .filter(m => m.title.toLowerCase().includes(term))
      .map(m => ({ id: m.id, title: m.title, description: 'Maintenance Log', href: `/dashboard/maintenance/${m.id}?propertyId=${m.propertyId}` }));
    if (maintenanceItems.length) results.push({ title: 'Maintenance', icon: Wrench, items: maintenanceItems.slice(0, 5) });
    
    // Inspections
    const inspectionItems = allData.inspections
      .filter(i => (i.type || '').toLowerCase().includes(term))
      .map(i => ({ id: i.id, title: `${i.type} Inspection`, description: 'Inspection Record', href: `/dashboard/inspections/${i.id}?propertyId=${i.propertyId}` }));
    if (inspectionItems.length) results.push({ title: 'Inspections', icon: CalendarCheck, items: inspectionItems.slice(0, 5) });

    return results;
  }, [searchTerm, allData]);

  const handleSelect = (href: string) => {
    router.push(href);
    onOpenChange(false);
    setSearchTerm('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { onOpenChange(open); if (!open) setSearchTerm(''); }}>
      <DialogContent className="p-0 gap-0 max-w-3xl overflow-hidden border-none shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search Portfolio</DialogTitle>
          <DialogDescription>Search properties, tenants, and maintenance tasks.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center px-6 border-b bg-background h-16">
          <Search className="h-5 w-5 text-muted-foreground mr-4" />
          <Input
            placeholder="Type to search portfolio..."
            className="flex-1 text-lg bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto bg-muted/5">
            {isLoading ? (
                <div className="flex flex-col justify-center items-center h-64 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">Scanning portfolio...</p>
                </div>
            ) : searchTerm && !searchResults.length ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                    <Search className="h-12 w-12 text-muted-foreground/10 mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">No matches found for "{searchTerm}"</p>
                    <p className="text-sm text-muted-foreground/60 max-w-xs mt-1">Try searching for a street name, tenant name, or maintenance issue.</p>
                </div>
            ) : !searchTerm ? (
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl border bg-card shadow-sm hover:border-primary/50 transition-colors">
                            <Home className="h-5 w-5 text-primary mb-3" />
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Properties</p>
                            <p className="text-sm text-muted-foreground">Find by street, city, or postcode.</p>
                        </div>
                        <div className="p-5 rounded-2xl border bg-card shadow-sm hover:border-primary/50 transition-colors">
                            <Users className="h-5 w-5 text-primary mb-3" />
                            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">People</p>
                            <p className="text-sm text-muted-foreground">Search tenants and contractors.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-2 pb-6">
                    {searchResults.map((group) => (
                        <div key={group.title} className="mb-4">
                            <h3 className="text-[10px] font-bold text-primary/60 px-4 py-2 uppercase tracking-[0.2em]">{group.title}</h3>
                            <ul className="space-y-1 px-2">
                                {group.items.map(item => (
                                    <li
                                        key={item.id}
                                        className="p-3 rounded-xl hover:bg-accent cursor-pointer group transition-all"
                                        onClick={() => handleSelect(item.href)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-lg bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                                                <group.icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm truncate">{item.title}</p>
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
        <div className="p-4 border-t bg-muted/30 flex justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest px-6">
            <span>RentSafeUK High-Performance Search</span>
            <span>{allData ? `${allData.properties.length + allData.tenants.length} Records Indexed` : 'Standby'}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}