
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
import { 
  Search, 
  PlusCircle, 
  FileWarning, 
  Clock, 
  ShieldCheck, 
  Loader2, 
  Filter, 
  Eye, 
  Edit, 
  Trash2, 
  MoreVertical,
  Download,
  FileText
} from 'lucide-react';
import { format, isBefore, addDays } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, limit, deleteDoc, doc } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { toast } from '@/hooks/use-toast';

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
    issueDate: any;
    expiryDate: any;
    fileUrl?: string;
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

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function DocumentsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [today, setToday] = useState<Date | null>(null);
    const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);

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
            const expiry = toDate(doc.expiryDate) || new Date();
            return {
                ...doc,
                status: getDocumentStatus(expiry, today),
                expiryDateObj: expiry
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

    const handleDeleteConfirm = async () => {
        if (!firestore || !user || !documentToDelete || !selectedPropertyId) return;
        try {
            await deleteDoc(doc(firestore, 'userProfiles', user.uid, 'properties', selectedPropertyId, 'documents', documentToDelete.id));
            toast({ title: 'Record Deleted', description: 'The document record has been removed.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the record.' });
        } finally {
            setDocumentToDelete(null);
        }
    };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="grid gap-4 md:grid-cols-3">
         <Card className="border-none shadow-md overflow-hidden relative">
            <div className="h-1 bg-destructive w-full absolute top-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Expired</CardTitle>
               <FileWarning className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold text-destructive">{(selectedPropertyId && today) ? expiredCount : '-'}</div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Needs attention</p>
            </CardContent>
         </Card>
         <Card className="border-none shadow-md overflow-hidden relative">
            <div className="h-1 bg-yellow-500 w-full absolute top-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Expiring Soon</CardTitle>
               <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold">{(selectedPropertyId && today) ? expiringSoonCount : '-'}</div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Due in 90 days</p>
            </CardContent>
         </Card>
          <Card className="border-none shadow-md overflow-hidden relative">
            <div className="h-1 bg-green-500 w-full absolute top-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Valid</CardTitle>
               <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
               <div className="text-3xl font-bold text-green-600">{(selectedPropertyId && today) ? validCount : '-'}</div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Compliant items</p>
            </CardContent>
         </Card>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <CardTitle className="text-xl font-headline">Portfolio Audit Trail</CardTitle>
                <CardDescription>Manage and track legal compliance documents.</CardDescription>
            </div>
            <Button asChild className="font-bold shadow-lg">
              <Link href="/dashboard/documents/upload">
                <PlusCircle className="mr-2 h-4 w-4" /> Log Document
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className='space-y-2'>
                <Label htmlFor="property-filter" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                    <Filter className="h-3 w-3" /> Property Context
                </Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="property-filter" className="h-11 bg-background">
                        <SelectValue placeholder={isLoadingProperties ? 'Syncing...' : 'Select property to audit'} />
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
            
            <div className="flex flex-col sm:flex-row gap-4 pt-6 md:pt-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search title..." className="pl-10 h-11 bg-background" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <Select onValueChange={setStatusFilter} value={statusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] h-11 bg-background font-bold text-xs uppercase">
                     <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="All">All Status</SelectItem>
                     <SelectItem value="Expired">Expired</SelectItem>
                     <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                     <SelectItem value="Valid">Valid</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>

          {isLoadingDocuments ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : !selectedPropertyId ? (
            <div className="text-center py-24 text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5">
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="font-bold text-foreground">Awaiting Property Context</p>
                <p className="text-xs uppercase tracking-widest mt-1">Select an active property to view its audit history.</p>
            </div>
          ) : !filteredDocuments?.length ? (
            <div className="text-center py-24 text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="font-bold text-foreground">No Records Found</p>
                <p className="text-xs uppercase tracking-widest mt-1">No documents match your current filters.</p>
            </div>
          ) : (
          <>
            <div className="hidden rounded-xl border md:block overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider pl-6">Document Title</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider">Expiry Date</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((docItem) => (
                    <TableRow key={docItem.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="py-4 pl-6">
                          <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-primary/5 text-primary">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div>
                                  <p className="font-bold text-sm">{docItem.title}</p>
                                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{docItem.documentType}</p>
                              </div>
                          </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(docItem.status)} className="text-[10px] font-bold uppercase">{docItem.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium tabular-nums">{format(docItem.expiryDateObj, 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {docItem.fileUrl ? (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="View File" asChild>
                                    <Link href={docItem.fileUrl} target="_blank"><Eye className="h-4 w-4" /></Link>
                                </Button>
                            ) : (
                                <Badge variant="outline" className="h-8 px-2 border-dashed text-[9px] opacity-50">No File</Badge>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/dashboard/documents/${docItem.id}/edit?propertyId=${selectedPropertyId}`}><Edit className="mr-2 h-4 w-4" /> Edit Details</Link>
                                    </DropdownMenuItem>
                                    {docItem.fileUrl && (
                                        <DropdownMenuItem asChild>
                                            <a href={docItem.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="mr-2 h-4 w-4" /> Download File</a>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDocumentToDelete(docItem)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 md:hidden">
              {filteredDocuments.map((docItem) => (
                <Card key={docItem.id} className="shadow-sm border-muted/60">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0"><FileText className="h-4 w-4" /></div>
                        <div>
                            <CardTitle className='text-sm font-bold'>{docItem.title}</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase tracking-tighter">{docItem.documentType}</CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {docItem.fileUrl && <DropdownMenuItem asChild><Link href={docItem.fileUrl} target="_blank"><Eye className="mr-2 h-4 w-4" /> View File</Link></DropdownMenuItem>}
                            <DropdownMenuItem asChild><Link href={`/dashboard/documents/${docItem.id}/edit?propertyId=${selectedPropertyId}`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDocumentToDelete(docItem)} className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-[11px] pt-0 pb-4 border-b border-dashed">
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-muted-foreground uppercase font-bold tracking-widest">Status</span>
                      <Badge variant={getStatusVariant(docItem.status)} className="h-5 text-[9px] font-bold uppercase">{docItem.status}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground uppercase font-bold tracking-widest">Expires</span>
                      <span className='font-bold tabular-nums'>{format(docItem.expiryDateObj, 'dd/MM/yyyy')}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl">Delete Audit Record?</AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium">
                    This will permanently remove the record for <strong className="text-foreground">{documentToDelete?.title}</strong>. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3 mt-4">
                <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-xs h-11">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-lg">Delete Record</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
