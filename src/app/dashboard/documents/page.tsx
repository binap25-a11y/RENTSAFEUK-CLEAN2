'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
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
import { Search, Upload, FileWarning, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Label } from '@/components/ui/label';

// Type for property documents from Firestore
interface Property {
  address: string;
  ownerId: string;
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

const getDocumentStatus = (expiryDate: Date) => {
    const today = new Date();
    const ninetyDaysFromNow = addDays(today, 90);
    
    if (isBefore(expiryDate, today)) {
        return 'Expired';
    }
    if (isBefore(expiryDate, ninetyDaysFromNow)) {
        return 'Expiring Soon';
    }
    return 'Valid';
};

const getStatusVariant = (status: string) => {
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

    // Fetch properties for the filter dropdown
    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'properties'),
            where('ownerId', '==', user.uid)
        );
    }, [firestore, user]);
    const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
    
    // Fetch documents for the selected property
    const documentsQuery = useMemoFirebase(() => {
        if (!user || !selectedPropertyId) return null;
        return query(collection(firestore, 'properties', selectedPropertyId, 'documents'));
    }, [firestore, user, selectedPropertyId]);

    const { data: documents, isLoading: isLoadingDocuments } = useCollection<Document>(documentsQuery);

    const documentsWithStatus = useMemo(() => {
        return documents?.map(doc => {
            const expiry = doc.expiryDate instanceof Date ? doc.expiryDate : new Date(doc.expiryDate.seconds * 1000);
            return {
                ...doc,
                status: getDocumentStatus(expiry),
                expiryDate: expiry
            };
        }) ?? [];
    }, [documents]);
    
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
    
    const getPropertyAddress = (propertyId: string) => {
        return properties?.find(p => p.id === propertyId)?.address || 'Unknown Property';
    };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Expired Documents</CardTitle>
               <FileWarning className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-destructive">{selectedPropertyId ? expiredCount : '-'}</div>
               <p className="text-xs text-muted-foreground">Needs immediate attention</p>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
               <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">{selectedPropertyId ? expiringSoonCount : '-'}</div>
               <p className="text-xs text-muted-foreground">Action required within 90 days</p>
            </CardContent>
         </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Valid Documents</CardTitle>
               <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">{selectedPropertyId ? validCount : '-'}</div>
               <p className="text-xs text-muted-foreground">All documents up to date</p>
            </CardContent>
         </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
          <CardDescription>
            Manage all your property-related documents in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-start">
            <Button asChild className='w-full md:w-auto'>
              <Link href="/dashboard/documents/upload">
                <Upload className="mr-2 h-4 w-4" /> Upload Document
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className='flex flex-col sm:flex-row gap-2 items-center'>
                 <div className="w-full md:w-auto">
                    <Label htmlFor="property-filter" className="sr-only">Filter by Property</Label>
                    <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                        <SelectTrigger id="property-filter" className="w-full md:w-[300px]">
                            <SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property to view documents'} />
                        </SelectTrigger>
                        <SelectContent>
                            {properties?.map(prop => (
                                <SelectItem key={prop.id} value={prop.id}>{prop.address}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by title..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Expiry Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDocuments && (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                    </TableRow>
                )}
                {!isLoadingDocuments && documents?.length === 0 && (
                     <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            {selectedPropertyId ? 'No documents found for this property.' : 'Select a property to see documents.'}
                        </TableCell>
                    </TableRow>
                )}
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{getPropertyAddress(doc.propertyId)}</TableCell>
                    <TableCell>{doc.documentType}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(doc.status)}>{doc.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{format(doc.expiryDate, 'dd/MM/yyyy')}</TableCell>
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
