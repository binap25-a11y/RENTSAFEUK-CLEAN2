'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  Search, 
  MoreVertical, 
  Edit, 
  Eye, 
  XCircle, 
  Trash2, 
  ArrowLeft,
  Calendar,
  AlertCircle,
  Filter,
  LayoutList,
  PlusCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, onSnapshot, limit } from 'firebase/firestore';

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
  status: string;
}

interface MaintenanceLog {
    id: string;
    propertyId: string;
    title: string;
    priority: string;
    status: string;
    reportedBy: string;
    reportedDate: { seconds: number; nanoseconds: number; } | Date;
}

export default function MaintenanceLoggedPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [logToCancel, setLogToCancel] = useState<MaintenanceLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<MaintenanceLog | null>(null);

  const [portfolioLogsMap, setPortfolioLogsMap] = useState<Record<string, MaintenanceLog[]>>({});

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
      limit(500)
    );
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const propertyIdsKey = useMemo(() => properties?.map(p => p.id).join(',') || '', [properties]);

  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop) => {
        acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) {
        setPortfolioLogsMap({});
        return;
    }

    const unsubs: (() => void)[] = [];

    properties.forEach(p => {
        const q = collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'maintenanceLogs');
        const unsub = onSnapshot(q, (snap) => {
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog));
            setPortfolioLogsMap(prev => ({ ...prev, [p.id]: logs }));
        }, (err) => { console.error(`Listener failed:`, err); });
        unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [user, propertyIdsKey, firestore, properties?.length]);

  const allCurrentLogs = useMemo(() => {
    if (selectedPropertyFilter === 'all') return Object.values(portfolioLogsMap).flat();
    return portfolioLogsMap[selectedPropertyFilter] || [];
  }, [selectedPropertyFilter, portfolioLogsMap]);

  const filteredLogs = useMemo(() => {
    if (!allCurrentLogs) return [];
    const term = searchTerm.toLowerCase();
    return allCurrentLogs
        .filter(log => log.status !== 'Deleted' && log.status !== 'Cancelled' && log.title.toLowerCase().includes(term))
        .sort((a, b) => {
            const dateA = a.reportedDate instanceof Date ? a.reportedDate : new Date((a.reportedDate as any).seconds * 1000);
            const dateB = b.reportedDate instanceof Date ? b.reportedDate : new Date((b.reportedDate as any).seconds * 1000);
            return dateB.getTime() - dateA.getTime();
        });
  }, [allCurrentLogs, searchTerm]);

  const handleStatusChange = async (logId: string, propertyId: string, newStatus: string) => {
    if (!firestore || !user) return;
    try {
      await updateDoc(doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'maintenanceLogs', logId), { status: newStatus });
      toast({ title: 'Status Updated' });
    } catch (error) { toast({ variant: 'destructive', title: 'Update Failed' }); }
  };

  const handleCancelConfirm = async () => {
    if (!firestore || !logToCancel || !user) return;
    try {
      await updateDoc(doc(firestore, 'userProfiles', user.uid, 'properties', logToCancel.propertyId, 'maintenanceLogs', logToCancel.id), { status: 'Cancelled' });
      toast({ title: 'Log Cancelled' });
    } catch (error) { toast({ variant: 'destructive', title: 'Update Failed' }); } finally { setLogToCancel(null); }
  };
  
  const handleDeleteConfirm = async () => {
    if (!firestore || !logToDelete || !user) return;
    try {
      await deleteDoc(doc(firestore, 'userProfiles', user.uid, 'properties', logToDelete.propertyId, 'maintenanceLogs', logToDelete.id));
      toast({ title: 'Log Deleted' });
    } catch (error) { toast({ variant: 'destructive', title: 'Delete Failed' }); } finally { setLogToDelete(null); }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'destructive';
      case 'Urgent': return 'secondary';
      default: return 'outline';
    }
  };
  
  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="shrink-0"><Link href="/dashboard/maintenance"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-primary">Maintenance History</h1>
            <p className="text-muted-foreground font-medium text-lg">Detailed audit of repairs across your portfolio.</p>
        </div>
      </div>

      <Card className="shadow-md border-none bg-muted/20">
        <CardHeader className="pb-4"><CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Filter & Search</CardTitle></CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Selected Property</Label>
                    <Select value={selectedPropertyFilter} onValueChange={setSelectedPropertyFilter}>
                        <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Choose filter" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Properties</SelectItem>
                            {properties?.map(prop => (<SelectItem key={prop.id} value={prop.id}>{formatAddress(prop.address)}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2"><Search className="h-3.5 w-3.5" />Search Issue Title</Label>
                    <Input placeholder="e.g., 'Leaking'..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-background" />
                </div>
            </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none shadow-xl">
        <CardHeader className="bg-muted/30 border-b pb-4"><CardTitle className="text-lg flex items-center gap-2 text-foreground"><LayoutList className="h-5 w-5 text-primary" />Maintenance Records</CardTitle></CardHeader>
        <CardContent className="p-0">
            {isLoadingProperties ? (
                <div className="flex flex-col justify-center items-center h-64 gap-2"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Fetching records...</p></div>
            ) : filteredLogs.length === 0 ? (
                <div className="text-center py-24 px-6 text-muted-foreground border-2 border-dashed m-6 rounded-lg bg-muted/5"><AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-lg font-medium text-foreground">No records found</p></div>
            ) : (
                <>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader className="bg-muted/20"><TableRow><TableHead className="pl-6">Issue Title</TableHead><TableHead>Property</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead className="text-right pr-6">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredLogs.map(log => (
                                    <TableRow key={log.id} className="hover:bg-muted/10 transition-colors group">
                                        <TableCell className="font-semibold pl-6 py-4"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} className="hover:underline text-primary">{log.title}</Link></TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]"><Link href={`/dashboard/properties/${log.propertyId}`} className="hover:underline">{propertyMap[log.propertyId]}</Link></TableCell>
                                        <TableCell><Select value={log.status} onValueChange={(v) => handleStatusChange(log.id, log.propertyId, v)}><SelectTrigger className="w-[140px] h-8 text-xs font-bold bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></TableCell>
                                        <TableCell><Badge variant={getPriorityVariant(log.priority)} className="capitalize text-[10px] font-bold">{log.priority}</Badge></TableCell>
                                        <TableCell className="text-right pr-6"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} title="View Details"><Eye className="h-4 w-4" /></Link></Button><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${log.propertyId}`} title="Edit Log"><Edit className="h-4 w-4" /></Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" title="More Options"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><DropdownMenuItem onClick={() => setLogToCancel(log)}><XCircle className="mr-2 h-4 w-4" /> Cancel Issue</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete Permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-4 md:hidden p-4">
                        {filteredLogs.map(log => (
                            <Card key={log.id} className="overflow-hidden shadow-sm border-muted/60">
                                <CardHeader className="pb-3"><div className="flex justify-between items-start"><div className="space-y-1"><Badge variant={getPriorityVariant(log.priority)} className="mb-1 text-[10px] font-bold uppercase">{log.priority}</Badge><CardTitle className="text-lg font-bold"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} className="hover:underline">{log.title}</Link></CardTitle><CardDescription className="flex items-center gap-1.5 mt-1 text-xs font-medium"><AlertCircle className="h-3 w-3 text-primary" /><Link href={`/dashboard/properties/${log.propertyId}`} className="hover:underline truncate">{propertyMap[log.propertyId]}</Link></CardDescription></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`}><Eye className="mr-2 h-4 w-4" /> View Details</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${log.propertyId}`}><Edit className="mr-2 h-4 w-4" /> Edit Log</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLogToCancel(log)}><XCircle className="mr-2 h-4 w-4" /> Cancel Log</DropdownMenuItem><DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></CardHeader>
                                <CardContent className="pb-3 border-t pt-3 bg-muted/5"><div className="flex items-center justify-between text-sm mb-3"><span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Status</span><Select value={log.status} onValueChange={(v) => handleStatusChange(log.id, log.propertyId, v)}><SelectTrigger className="w-[140px] h-9 bg-background"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div><div className="flex items-center justify-between text-xs text-muted-foreground font-medium"><span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Reported</span><span className="font-bold text-foreground">{log.reportedDate instanceof Date ? format(log.reportedDate, 'dd/MM/yyyy') : format(new Date((log.reportedDate as any).seconds * 1000), 'dd/MM/yyyy')}</span></div></CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </CardContent>
      </Card>

      {/* Grouped Action Buttons below the records list card */}
      <div className="px-1">
          <Button asChild className="w-full font-bold shadow-lg h-11 px-8 bg-primary hover:bg-primary/90 transition-all">
            <Link href="/dashboard/maintenance">
                <PlusCircle className="mr-2 h-4 w-4" /> Record New Maintenance Issue
            </Link>
          </Button>
      </div>

      <AlertDialog open={!!logToCancel} onOpenChange={(open) => !open && setLogToCancel(null)}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="text-xl">Cancel Maintenance Issue?</AlertDialogTitle><AlertDialogDescription className="text-base font-medium">This will mark "<strong className="text-foreground">{logToCancel?.title}</strong>" as 'Cancelled'.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-3 mt-4"><AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-xs h-11">Go Back</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-lg" onClick={handleCancelConfirm}>Confirm Cancellation</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="text-xl">Permanent Deletion</AlertDialogTitle><AlertDialogDescription className="text-base font-medium text-destructive">Are you absolutely sure? This will permanently delete the record for "<strong className="text-foreground">{logToDelete?.title}</strong>". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-3 mt-4"><AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-xs h-11">Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-lg" onClick={handleDeleteConfirm}>Delete Permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
