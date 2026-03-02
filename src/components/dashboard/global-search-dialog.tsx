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
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Home, Users, HardHat, Loader2, Search } from 'lucide-react';

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
  ownerId: string;
}
interface Tenant extends Searchable { name: string; email: string; status?: string; propertyId: string; }
interface Contractor extends Searchable { name: string; trade: string; status?: string; }

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
  } | null>(null);

  useEffect(() => {
    if (isOpen && !allData && user && firestore) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          // Strictly hierarchical fetches
          const propertiesCollection = collection(firestore, 'userProfiles', user.uid, 'properties');
          const contractorsCollection = collection(firestore, 'userProfiles', user.uid, 'contractors');
          
          const [propSnap, contractorSnap] = await Promise.all([
            getDocs(query(propertiesCollection, limit(100))),
            getDocs(query(contractorsCollection, limit(100)))
          ]);
          
          const properties = propSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property));
          const contractors = contractorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Contractor));
          
          // Efficiently fetch tenants for active properties
          const tenantPromises = properties.map(p => 
            getDocs(query(collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'tenants'), limit(10)))
          );
          const tenantSnaps = await Promise.all(tenantPromises);
          const tenants = tenantSnaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant)));
          
          setAllData({ properties, tenants, contractors });
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
        return [address.nameOrNumber, address.street, address.city, address.county, address.postcode].filter(Boolean).join(', ');
    }

    const propertyItems = allData.properties
      .filter(p => p.status !== 'Deleted' && formatAddress(p.address).toLowerCase().includes(term))
      .map(p => ({ id: p.id, title: formatAddress(p.address), description: 'Property', href: `/dashboard/properties/${p.id}` }));
    if (propertyItems.length) results.push({ title: 'Properties', icon: Home, items: propertyItems.slice(0, 5) });

    const tenantItems = allData.tenants
      .filter(t => t.name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term))
      .map(t => ({ 
          id: t.id, 
          title: t.name, 
          description: t.status === 'Archived' ? 'Archived Tenant' : 'Tenant', 
          href: `/dashboard/tenants/${t.id}?propertyId=${t.propertyId}` 
      }));
    if (tenantItems.length) results.push({ title: 'Tenants', icon: Users, items: tenantItems.slice(0, 5) });
    
    const contractorItems = allData.contractors
      .filter(c => c.name.toLowerCase().includes(term) || c.trade.toLowerCase().includes(term))
      .map(c => ({ id: c.id, title: c.name, description: 'Contractor', href: `/dashboard/contractors/${c.id}` }));
    if (contractorItems.length) results.push({ title: 'Contractors', icon: HardHat, items: contractorItems.slice(0, 5) });

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
          <DialogDescription>Search properties, tenants, and contractors across your entire portfolio.</DialogDescription>
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
                    <p className="text-sm text-muted-foreground/60 max-w-xs mt-1">Try searching for a street name or tenant name.</p>
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
