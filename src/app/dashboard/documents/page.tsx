'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, PlusCircle, FileWarning, Clock, ShieldCheck, Loader2, Filter } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { Label } from '@/components/ui/label';

// Type for property documents from Firestore
interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
  ownerId: string;
  status: string;
}

// Type for document logs from Firestore
interface Document {
    id: string;
    title: string;
    propertyId: string;
    documentType: string;
    issueDate: { seconds: number; nanoseconds: number; } | Date;
    expiryDate: { seconds: number; nanoseconds: number; } | Date;
    propertyAddress?: string; // For display
}

const getDocumentStatus = (expiryDate: Date, today: Date) => {
    const ninetyDaysFromNow = addDays(today, 90);
    
    if (isBefore(expiryDate, today)) {
        return 'Expired';
    }
    if (isBefore(expiryDate, ninetyDaysFromNow)) {
        return 'Expiring Soon';
    }
    return 'Valid';
};

const getStatusVariant = (status: string): "destructive" | "secondary" | "outline" => {
  switch (status) {
    case 'Expired':
      return 'destructive';
    case 'Expiring Soon':
      return 'secondary';
    default:
      return 'outline';
  }
};

export default function DocumentsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [today, setToday] = useState<Date | null>(null);

    useEffect(() => {
        setToday(new Date());
    }, []);

    // Fetch properties - strictly hierarchical
    const propertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'userProfiles', user.uid, 'properties'),
            where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
            limit(500)
        );
    }, [firestore, user]);
    const { data: activeProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
    
    // Fetch documents for the selected property
    const documentsQuery = useMemoFirebase(() => {
        if (!user || !firestore || !selectedPropertyId) return null;
        return query(
          collection(firestore, 'userProfiles', user.uid, 'properties', selectedPropertyId, 'documents'),
          limit(500)
        );
    }, [firestore, user, selectedPropertyId]);

    const { data: documents, isLoading: isLoadingDocuments } = useCollection<Document>(documentsQuery);

    const documentsWithStatus = useMemo(() => {
        if (!today) return [];
        return documents?.map(doc => {
            const expiry = doc.expiryDate instanceof Date ? doc.expiryDate : new Date((doc.expiryDate as any).seconds * 1000);
            return {
                ...doc,
                status: getDocumentStatus(expiry, today),
                expiryDate: expiry
            };
        }) ?? [];
    }, [documents, today]);
    
    const filteredDocuments = useMemo(() => {
        return documentsWithStatus.filter(doc => {
            const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' || doc.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [documentsWithStatus, searchTerm, statusFilter]);
    
    const expiredCount = documentsWithStatus.filter(d => d.status === 'Expired').length;
    const expiringSoonCount = documentsWithStatus.filter(d => d.status === 'Expiring Soon').length;
    const validCount = documentsWithStatus.filter(d => d.status === 'Valid').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Expired Documents</CardTitle>
               <FileWarning className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-destructive">{(selectedPropertyId && today) ? expiredCount : '-'}</div>
               <p className="text-xs text-muted-foreground">Needs immediate attention</p>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
               <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">{(selectedPropertyId && today) ? expiringSoonCount : '-'}</div>
               <p className="text-xs text-muted-foreground">Action required within 90 days</p>
            </CardContent>
         </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Valid Documents</CardTitle>
               <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">{(selectedPropertyId && today) ? validCount : '-'}</div>
               <p className="text-xs text-muted-foreground">All documents up to date</p>
            </CardContent>
         </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Documents</CardTitle>
          <CardDescription>
            Manage and track legal compliance documents across your portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-start">
            <Button asChild className='w-full md:w-auto'>
              <Link href="/dashboard/documents/upload">
                <PlusCircle className="mr-2 h-4 w-4" /> Log Document
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className='flex flex-col space-y-2'>
                <Label htmlFor="property-filter" className="text-sm font-semibold flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5" />
                    Filter by Active Property
                </Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="property-filter" className="w-full md:w-[400px] h-12 bg-background">
                        <SelectValue placeholder={isLoadingProperties ? 'Loading portfolio...' : 'Select a property to view documents'} />
                    </SelectTrigger>
                    <SelectContent>
                        {activeProperties?.map(prop => (
                            <SelectItem key={prop.id} value={prop.id}>
                                {[prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ')}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative w-full md:max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by title..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <Select onValueChange={setStatusFilter} value={statusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                     <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="All">All Documents</SelectItem>
                     <SelectItem value="Expired">Expired</SelectItem>
                     <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                     <SelectItem value="Valid">Valid</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>

          {isLoadingDocuments ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !selectedPropertyId ? (
            <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
                <Filter className="h-10 w-10 mx-auto mb-4 opacity-20" />
                <p>Select an active property from the list to see its documents.</p>
            </div>
          ) : !filteredDocuments?.length ? (
            <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
                <FileWarning className="h-10 w-10 mx-auto mb-4 opacity-20" />
                <p>No documents match your search filters for this property.</p>
            </div>
          ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-muted/20">
                      <TableCell className="font-semibold">{doc.title}</TableCell>
                      <TableCell>{doc.documentType}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(doc.status)}>{doc.status}</Badge>
                      </TableCell>
                      <TableCell>{format(doc.expiryDate, 'dd/MM/yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="grid gap-4 md:hidden">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className='text-base font-bold'>{doc.title}</CardTitle>
                        <CardDescription>{doc.documentType}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm pt-0">
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={getStatusVariant(doc.status)}>{doc.status}</Badge>
                    </div>
                    <div className="flex justify-between items-center border-t pt-2">
                      <span className="text-muted-foreground">Expires</span>
                      <span className='font-medium'>{format(doc.expiryDate, 'dd/MM/yyyy')}</span>
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
  );
}
