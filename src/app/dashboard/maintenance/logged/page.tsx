'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
  LayoutList
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
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [logToCancel, setLogToCancel] = useState<MaintenanceLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<MaintenanceLog | null>(null);

  const [portfolioLogsMap, setPortfolioLogsMap] = useState<Record<string, MaintenanceLog[]>>({});

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const properties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status || '')) ?? [];
  }, [allProperties]);

  const propertyIdsKey = useMemo(() => properties.map(p => p.id).join(','), [properties]);

  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop) => {
        acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  useEffect(() => {
    if (!user || !firestore || properties.length === 0) {
        setPortfolioLogsMap({});
        return;
    }

    const unsubs: (() => void)[] = [];

    properties.forEach(p => {
        const q = query(
            collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'maintenanceLogs'), 
            where('ownerId', '==', user.uid)
        );
        const unsub = onSnapshot(q, (snap) => {
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog));
            setPortfolioLogsMap(prev => ({ ...prev, [p.id]: logs }));
        }, (err) => { console.error(`Listener failed:`, err); });
        unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [user, propertyIdsKey, firestore, properties.length]);

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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild><Link href="/dashboard/maintenance"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div><h1 className="text-3xl font-bold font-headline">Maintenance Logged</h1><p className="text-muted-foreground">View repairs across your portfolio.</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle>Filter & Search</CardTitle></CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Selected Property</Label>
                    <Select value={selectedPropertyFilter} onValueChange={setSelectedPropertyFilter}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Choose filter" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Properties</SelectItem>
                            {properties?.map(prop => (<SelectItem key={prop.id} value={prop.id}>{formatAddress(prop.address)}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2"><Search className="h-3.5 w-3.5" />Search Issue Title</Label>
                    <Input placeholder="e.g., 'Leaking'..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden border-none shadow-lg">
        <CardHeader className="bg-muted/30 border-b pb-4"><CardTitle className="text-lg flex items-center gap-2"><LayoutList className="h-5 w-5 text-primary" />Maintenance Records</CardTitle></CardHeader>
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
                                        <TableCell className="font-semibold pl-6 py-4"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} className="hover:underline">{log.title}</Link></TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate"><Link href={`/dashboard/properties/${log.propertyId}`} className="hover:underline">{propertyMap[log.propertyId]}</Link></TableCell>
                                        <TableCell><Select value={log.status} onValueChange={(v) => handleStatusChange(log.id, log.propertyId, v)}><SelectTrigger className="w-[140px] h-8 text-xs font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></TableCell>
                                        <TableCell><Badge variant={getPriorityVariant(log.priority)} className="capitalize text-[10px]">{log.priority}</Badge></TableCell>
                                        <TableCell className="text-right pr-6"><div className="flex justify-end gap-1"><Button asChild variant="ghost" size="icon"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`}><Eye className="h-4 w-4" /></Link></Button><Button asChild variant="ghost" size="icon"><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${log.propertyId}`}><Edit className="h-4 w-4" /></Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setLogToCancel(log)}>Cancel Issue</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive">Delete Permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-4 md:hidden p-4">
                        {filteredLogs.map(log => (
                            <Card key={log.id} className="overflow-hidden shadow-sm">
                                <CardHeader className="pb-3"><div className="flex justify-between items-start"><div className="space-y-1"><Badge variant={getPriorityVariant(log.priority)} className="mb-1 text-[10px]">{log.priority}</Badge><CardTitle className="text-lg"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} className="hover:underline">{log.title}</Link></CardTitle><CardDescription className="flex items-center gap-1.5 mt-1 text-xs"><AlertCircle className="h-3 w-3" /><Link href={`/dashboard/properties/${log.propertyId}`} className="hover:underline">{propertyMap[log.propertyId]}</Link></CardDescription></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`}>View Details</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${log.propertyId}`}>Edit Log</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLogToCancel(log)}>Cancel Log</DropdownMenuItem><DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive">Delete Permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></CardHeader>
                                <CardContent className="pb-3 border-t pt-3"><div className="flex items-center justify-between text-sm mb-3"><span className="text-muted-foreground font-medium">Status</span><Select value={log.status} onValueChange={(v) => handleStatusChange(log.id, log.propertyId, v)}><SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div><div className="flex items-center justify-between text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Reported</span><span className="font-medium text-foreground">{log.reportedDate instanceof Date ? format(log.reportedDate, 'dd/MM/yyyy') : format(new Date((log.reportedDate as any).seconds * 1000), 'dd/MM/yyyy')}</span></div></CardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </CardContent>
      </Card>
      <AlertDialog open={!!logToCancel} onOpenChange={(open) => !open && setLogToCancel(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancel Maintenance Issue?</AlertDialogTitle><AlertDialogDescription>This will mark "{logToCancel?.title}" as 'Cancelled'.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Go Back</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleCancelConfirm}>Confirm Cancellation</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Permanent Deletion</AlertDialogTitle><AlertDialogDescription>Are you absolutely sure? This will delete "{logToDelete?.title}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteConfirm}>Delete Permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
