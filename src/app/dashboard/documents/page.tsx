
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
  FileText,
  AlertCircle,
  Users
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

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
  landlordId: string;
  status: string;
}

interface DocumentRecord {
    id: string;
    title: string;
    propertyId: string;
    landlordId: string;
    documentType: string;
    issueDate: any;
    expiryDate: any;
    fileUrl?: string;
    sharedWithTenant?: boolean;
}

const getDocumentStatus = (expiryDate: Date | null, today: Date) => {
    if (!expiryDate) return 'Valid';
    const ninetyDaysFromNow = addDays(today, 90);
    if (isBefore(expiryDate, today)) return 'Expired';
    if (isBefore(expiryDate, ninetyDaysFromNow)) return 'Expiring Soon';
    return 'Valid';
};

const getStatusVariant = (status: string): "destructive" | "secondary" | "outline" => {
  switch (status) {
    case 'Expired': return 'destructive';
    case 'Expiring Soon': return 'secondary';
    default: return 'outline';
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
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [today, setToday] = useState<Date | null>(null);
    const [documentToDelete, setDocumentToDelete] = useState<DocumentRecord | null>(null);

    useEffect(() => { setToday(new Date()); }, []);

    // 1. Fetch active properties using flat root collection
    const propertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'properties'),
            where('landlordId', '==', user.uid),
            where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
            limit(500)
        );
    }, [firestore, user]);
    const { data: activeProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
    
    // 2. Fetch all documents for this landlord using high-performance flat query
    const documentsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
          collection(firestore, 'documents'),
          where('landlordId', '==', user.uid),
          limit(500)
        );
    }, [firestore, user]);
    const { data: allDocuments, isLoading: isLoadingDocuments } = useCollection<DocumentRecord>(documentsQuery);

    const propertyMap = useMemo(() => {
        if (!activeProperties) return {};
        return activeProperties.reduce((acc, prop) => {
            acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
            return acc;
        }, {} as Record<string, string>);
    }, [activeProperties]);

    const documentsWithStatus = useMemo(() => {
        if (!today || !allDocuments) return [];
        return allDocuments.map(doc => {
            const expiry = toDate(doc.expiryDate);
            return {
                ...doc,
                status: getDocumentStatus(expiry, today),
                expiryDateObj: expiry
            };
        });
    }, [allDocuments, today]);
    
    const filteredDocuments = useMemo(() => {
        return documentsWithStatus.filter(doc => {
            const matchesProperty = selectedPropertyId === 'all' || doc.propertyId === selectedPropertyId;
            const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'All' || doc.status === statusFilter;
            return matchesProperty && matchesSearch && matchesStatus;
        });
    }, [documentsWithStatus, searchTerm, statusFilter, selectedPropertyId]);
    
    const expiredCount = documentsWithStatus.filter(d => d.status === 'Expired').length;
    const expiringSoonCount = documentsWithStatus.filter(d => d.status === 'Expiring Soon').length;
    const validCount = documentsWithStatus.filter(d => d.status === 'Valid').length;

    const handleDeleteConfirm = async () => {
        if (!firestore || !user || !documentToDelete) return;
        try {
            await deleteDoc(doc(firestore, 'documents', documentToDelete.id));
            toast({ title: 'Record Deleted', description: 'The document record has been removed.' });
        } catch (e) { toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the record.' }); } finally { setDocumentToDelete(null); }
    };

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto text-left">
      <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Portfolio Audit Trail</h1>
        </div>
        <p className="text-muted-foreground font-medium text-lg ml-1">Manage legal compliance and shared files across your estate.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-2xl shadow-sm border">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search document titles..." 
            className="pl-10 h-11 bg-background border-muted rounded-xl focus-visible:ring-primary" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
          />
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto font-bold shadow-md h-11 px-8 rounded-xl shrink-0">
          <Link href="/dashboard/documents/upload">
            <PlusCircle className="mr-2 h-5 w-5" /> Log New Document
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
         <Card className="border-none shadow-md overflow-hidden relative">
            <div className="h-1 bg-destructive w-full absolute top-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Expired</CardTitle>
                <FileWarning className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-destructive">{today ? expiredCount : '-'}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Needs immediate attention</p>
            </CardContent>
         </Card>
         <Card className="border-none shadow-md overflow-hidden relative">
            <div className="h-1 bg-yellow-500 w-full absolute top-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Expiring Soon</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold">{today ? expiringSoonCount : '-'}</div>
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
                <div className="text-3xl font-bold text-green-600">{today ? validCount : '-'}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Compliant items</p>
            </CardContent>
          </Card>
      </div>

      <Card className="border-none shadow-xl overflow-hidden bg-card/50">
        <CardContent className="pt-8 space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
              <div className='space-y-2 text-left'>
                  <Label htmlFor="property-filter" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 px-1"><Filter className="h-3 w-3" /> Filter by Property</Label>
                  <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                      <SelectTrigger id="property-filter" className="h-12 bg-background rounded-xl border-2 border-muted">
                          <SelectValue placeholder={isLoadingProperties ? 'Syncing portfolio...' : 'All Properties'} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                          <SelectItem value="all">All Properties</SelectItem>
                          {activeProperties?.map(prop => (<SelectItem key={prop.id} value={prop.id}>{[prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ')}</SelectItem>))}
                      </SelectContent>
                  </Select>
              </div>
              <div className='space-y-2 text-left'>
                  <Label htmlFor="status-filter" className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2 px-1"><ShieldCheck className="h-3 w-3" /> Compliance Status</Label>
                  <Select onValueChange={setStatusFilter} value={statusFilter}>
                      <SelectTrigger id="status-filter" className="h-12 bg-background rounded-xl border-2 border-muted font-bold text-xs uppercase"><SelectValue placeholder="All Status" /></SelectTrigger>
                      <SelectContent className="rounded-xl"><SelectItem value="All">All Status</SelectItem><SelectItem value="Expired" className="text-destructive font-bold">Expired</SelectItem><SelectItem value="Expiring Soon" className="text-yellow-600 font-bold">Expiring Soon</SelectItem><SelectItem value="Valid" className="text-green-600 font-bold">Valid</SelectItem></SelectContent>
                  </Select>
              </div>
          </div>

          {isLoadingDocuments ? (
            <div className="flex flex-col justify-center items-center h-64 gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Scanning records...</p></div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-32 text-muted-foreground border-2 border-dashed rounded-[2rem] bg-muted/5 flex flex-col items-center justify-center gap-4 mx-2"><div className="p-6 rounded-full bg-background shadow-xl"><Search className="h-12 w-12 text-primary/20" /></div><div><p className="font-bold text-lg text-foreground">No Records Found</p><p className="text-sm max-w-xs mx-auto mt-1">No documents match your current filter criteria.</p></div></div>
          ) : (
            <div className="hidden rounded-[1.5rem] border-2 border-muted md:block overflow-hidden shadow-sm bg-background">
              <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead className="font-bold text-[10px] uppercase tracking-wider pl-8 py-4">Document Title</TableHead><TableHead className="font-bold text-[10px] uppercase tracking-wider">Property</TableHead><TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">Privacy</TableHead><TableHead className="font-bold text-[10px] uppercase tracking-wider">Compliance Status</TableHead><TableHead className="font-bold text-[10px] uppercase tracking-wider">Expiry Date</TableHead><TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-8">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredDocuments.map((docItem) => (
                    <TableRow key={docItem.id} className="hover:bg-muted/20 transition-all group">
                      <TableCell className="py-5 pl-8 text-left"><div className="flex items-center gap-4"><div className="p-3 rounded-2xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm"><FileText className="h-5 w-5" /></div><div className="text-left"><p className="font-bold text-sm text-foreground">{docItem.title}</p><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{docItem.documentType}</p></div></div></TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium max-w-[150px] truncate text-left">{propertyMap[docItem.propertyId] || 'Assigned Property'}</TableCell>
                      <TableCell className="text-center">
                        {docItem.sharedWithTenant ? (
                          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 text-[8px] uppercase gap-1 font-bold h-5 px-2">
                            <Users className="h-2.5 w-2.5" /> Shared
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] uppercase font-bold h-5 px-2 opacity-40">Private</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-left"><Badge variant={getStatusVariant(docItem.status)} className="text-[10px] font-bold uppercase px-3 py-1 rounded-lg tracking-tighter">{docItem.status}</Badge></TableCell>
                      <TableCell className="text-xs font-bold tabular-nums text-muted-foreground text-left">{docItem.expiryDateObj ? format(docItem.expiryDateObj, 'dd/MM/yyyy') : 'No Expiry'}</TableCell>
                      <TableCell className="text-right pr-8"><div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">{docItem.fileUrl ? (<Button variant="secondary" size="icon" className="h-9 w-9 rounded-xl shadow-sm hover:scale-110 transition-transform" title="View File" asChild><Link href={docItem.fileUrl} target="_blank"><Eye className="h-4 w-4" /></Link></Button>) : (<Badge variant="outline" className="h-9 px-3 border-dashed text-[9px] font-bold uppercase tracking-widest opacity-40 bg-muted/10">No Attachment</Badge>)}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl p-1 shadow-2xl border-2"><DropdownMenuItem asChild className="rounded-lg"><Link href={`/dashboard/documents/${docItem.id}/edit?propertyId=${docItem.propertyId}`} className="cursor-pointer"><Edit className="mr-2 h-4 w-4" /> Edit Record Details</Link></DropdownMenuItem>{docItem.fileUrl && (<DropdownMenuItem asChild className="rounded-lg"><a href={docItem.fileUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer"><Download className="mr-2 h-4 w-4" /> Download Attachment</a></DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg cursor-pointer font-bold" onClick={() => setDocumentToDelete(docItem)}><Trash2 className="mr-2 h-4 w-4" /> Delete Audit Record</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={!!documentToDelete} onOpenChange={(open) => !open && setDocumentToDelete(null)}><AlertDialogContent className="rounded-[2rem] border-none shadow-2xl text-left"><AlertDialogHeader className="text-left"><div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4"><AlertCircle className="h-8 w-8 text-destructive" /></div><AlertDialogTitle className="text-xl text-center">Delete Audit Record?</AlertDialogTitle><AlertDialogDescription className="text-base font-medium text-center">This will permanently remove the record for <strong className="text-foreground">{documentToDelete?.title}</strong> and its associated file attachment. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-3 mt-6 flex-col-reverse sm:flex-row"><AlertDialogCancel className="rounded-2xl font-bold uppercase tracking-widest text-xs h-12 flex-1 border-2">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl font-bold uppercase tracking-widest text-xs h-12 flex-1 shadow-lg">Delete Record</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
