
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
  PlusCircle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

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
    reportedDate: any;
}

function safeToDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export default function MaintenanceLoggedPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [logToCancel, setLogToCancel] = useState<MaintenanceLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<MaintenanceLog | null>(null);

  /**
   * INTERACTION RECOVERY
   * Proactively resets body pointer events if a modal closing doesn't trigger correctly.
   */
  useEffect(() => {
    const cleanup = () => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    };
    if (!logToCancel && !logToDelete) {
      const timeout = setTimeout(cleanup, 150);
      return () => clearTimeout(timeout);
    }
  }, [logToCancel, logToDelete]);

  // 1. Fetch properties using flat root collection
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'),
      where('landlordId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
      limit(500)
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  // 2. Fetch all repairs for this landlord using high-performance flat query
  const logsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    let q = query(
        collection(firestore, 'repairs'),
        where('landlordId', '==', user.uid),
        limit(500)
    );
    return q;
  }, [user, firestore]);
  const { data: allLogs, isLoading: isLoadingLogs } = useCollection<MaintenanceLog>(logsQuery);

  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop) => {
        acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  const filteredLogs = useMemo(() => {
    if (!allLogs) return [];
    const term = searchTerm.toLowerCase();
    return allLogs
        .filter(log => {
            const matchesProperty = selectedPropertyFilter === 'all' || log.propertyId === selectedPropertyFilter;
            const matchesTerm = log.title.toLowerCase().includes(term);
            const isNotDeleted = log.status !== 'Deleted';
            return matchesProperty && matchesTerm && isNotDeleted;
        })
        .sort((a, b) => {
            const dateA = safeToDate(a.reportedDate) || new Date(0);
            const dateB = safeToDate(b.reportedDate) || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
  }, [allLogs, searchTerm, selectedPropertyFilter]);

  const handleStatusChange = async (logId: string, newStatus: string) => {
    if (!firestore || !user) return;
    try {
      await updateDoc(doc(firestore, 'repairs', logId), { status: newStatus });
      toast({ title: 'Status Updated', description: `Request marked as ${newStatus}.` });
    } catch (error) { toast({ variant: 'destructive', title: 'Update Failed' }); }
  };

  const handleCancelConfirm = async () => {
    if (!firestore || !logToCancel || !user) return;
    const id = logToCancel.id;
    setLogToCancel(null); // Immediate state clear
    try {
      await updateDoc(doc(firestore, 'repairs', id), { status: 'Cancelled' });
      toast({ title: 'Log Cancelled' });
    } catch (error) { 
        toast({ variant: 'destructive', title: 'Update Failed' }); 
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!firestore || !logToDelete || !user) return;
    const id = logToDelete.id;
    setLogToDelete(null); // Immediate state clear to unlock UI
    try {
      await deleteDoc(doc(firestore, 'repairs', id));
      toast({ title: 'Log Deleted' });
    } catch (error) { 
        toast({ variant: 'destructive', title: 'Delete Failed' }); 
    }
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
        <div className="text-left">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-primary">Maintenance History</h1>
            <p className="text-muted-foreground font-medium text-lg">Detailed audit of repairs across your portfolio.</p>
        </div>
      </div>

      <Card className="shadow-md border-none bg-muted/20">
        <CardHeader className="pb-4 text-left"><CardTitle className="text-sm uppercase tracking-widest font-bold text-muted-foreground text-left">Filter & Search</CardTitle></CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-left">
                    <Label htmlFor="property-filter" className="text-sm font-semibold flex items-center gap-2"><Filter className="h-3.5 w-3.5" />Selected Property</Label>
                    <Select value={selectedPropertyFilter} onValueChange={setSelectedPropertyFilter}>
                        <SelectTrigger id="property-filter" className="w-full bg-background h-11">
                            <SelectValue placeholder={isLoadingProperties ? "Loading..." : "Choose filter"} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-2 shadow-2xl">
                            <SelectItem value="all" className="py-3 font-bold">All Properties</SelectItem>
                            {properties?.map(prop => (<SelectItem key={prop.id} value={prop.id} className="py-3 font-medium">{formatAddress(prop.address)}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 text-left">
                    <Label htmlFor="search-logs" className="text-sm font-semibold flex items-center gap-2"><Search className="h-3.5 w-3.5" />Search Issue Title</Label>
                    <Input id="search-logs" placeholder="e.g., 'Leaking'..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-background h-11" />
                </div>
            </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-none shadow-xl">
        <CardHeader className="bg-muted/30 border-b pb-4 text-left"><CardTitle className="text-lg flex items-center gap-2 text-foreground text-left"><LayoutList className="h-5 w-5 text-primary" />Maintenance Records</CardTitle></CardHeader>
        <CardContent className="p-0">
            {isLoadingLogs ? (
                <div className="flex flex-col justify-center items-center h-64 gap-2 text-left"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Fetching records...</p></div>
            ) : filteredLogs.length === 0 ? (
                <div className="text-center py-24 px-6 text-muted-foreground border-2 border-dashed m-6 rounded-lg bg-muted/5"><AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-lg font-medium text-foreground">No records found</p></div>
            ) : (
                <>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader className="bg-muted/20 text-left"><TableRow><TableHead className="pl-6 text-left">Issue Title</TableHead><TableHead className="text-left">Property</TableHead><TableHead className="text-left">Status</TableHead><TableHead className="text-left">Priority</TableHead><TableHead className="text-right pr-6">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredLogs.map(log => (
                                    <TableRow key={log.id} className="hover:bg-muted/10 transition-colors group">
                                        <TableCell className="font-semibold pl-6 py-4 text-left">
                                            <div className="flex items-center gap-2">
                                                {log.status === 'Open' && <span className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(167,209,171,0.8)]" title="Action Required" />}
                                                <Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} className="hover:underline text-primary">{log.title}</Link>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px] text-left">{propertyMap[log.propertyId] || 'Assigned Property'}</TableCell>
                                        <TableCell className="text-left">
                                            <Select value={log.status} onValueChange={(v) => handleStatusChange(log.id, v)}>
                                                <SelectTrigger className={cn(
                                                    "w-[160px] h-9 text-xs font-bold bg-background shadow-sm border-2",
                                                    log.status === 'Open' && "border-primary text-primary"
                                                )}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border-2 shadow-2xl min-w-[180px]">
                                                    <SelectItem value="Open" className="py-3 font-bold cursor-pointer">Open</SelectItem>
                                                    <SelectItem value="In Progress" className="py-3 font-bold cursor-pointer">In Progress</SelectItem>
                                                    <SelectItem value="Completed" className="py-3 font-bold cursor-pointer">Completed</SelectItem>
                                                    <SelectItem value="Cancelled" className="py-3 font-bold cursor-pointer">Cancelled</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-left"><Badge variant={getPriorityVariant(log.priority)} className="capitalize text-[10px] font-bold">{log.priority}</Badge></TableCell>
                                        <TableCell className="text-right pr-6"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} title="View Details"><Eye className="h-4 w-4" /></Link></Button><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${log.propertyId}`} title="Edit Log"><Edit className="h-4 w-4" /></Link></Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" title="More Options"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><DropdownMenuItem onClick={() => setLogToCancel(log)}><XCircle className="mr-2 h-4 w-4" /> Cancel Issue</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete Permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-4 md:hidden p-4">
                        {filteredLogs.map(log => {
                            const date = safeToDate(log.reportedDate);
                            return (
                                <Card key={log.id} className="overflow-hidden shadow-sm border-muted/60 text-left">
                                    <CardHeader className="pb-3 text-left"><div className="flex justify-between items-start text-left"><div className="space-y-1 text-left"><Badge variant={getPriorityVariant(log.priority)} className="mb-1 text-[10px] font-bold uppercase">{log.priority}</Badge><CardTitle className="text-lg font-bold text-left"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`} className="hover:underline">{log.title}</Link></CardTitle><CardDescription className="flex items-center gap-1.5 mt-1 text-xs font-medium text-left"><AlertCircle className="h-3 w-3 text-primary" />{propertyMap[log.propertyId] || 'Assigned Property'}</CardDescription></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`}><Eye className="mr-2 h-4 w-4" /> View Details</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${log.propertyId}`}><Edit className="mr-2 h-4 w-4" /> Edit Log</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLogToCancel(log)}><XCircle className="mr-2 h-4 w-4" /> Cancel Log</DropdownMenuItem><DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></CardHeader>
                                    <CardContent className="pb-3 border-t pt-3 bg-muted/5 text-left"><div className="flex items-center justify-between text-sm mb-3"><span className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest text-left">Status</span><Select value={log.status} onValueChange={(v) => handleStatusChange(log.id, v)}><SelectTrigger className="w-[160px] h-10 bg-background border-2"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl border-2 shadow-2xl"><SelectItem value="Open" className="py-3 font-bold">Open</SelectItem><SelectItem value="In Progress" className="py-3 font-bold">In Progress</SelectItem><SelectItem value="Completed" className="py-3 font-bold">Completed</SelectItem><SelectItem value="Cancelled" className="py-3 font-bold">Cancelled</SelectItem></SelectContent></Select></div><div className="flex items-center justify-between text-xs text-muted-foreground font-medium text-left"><span className="flex items-center gap-1.5 text-left"><Calendar className="h-3.5 w-3.5" />Reported</span><span className="font-bold text-foreground">{date ? format(date, 'dd/MM/yyyy') : 'Recently'}</span></div></CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}
        </CardContent>
      </Card>

      <div className="px-1 text-left">
          <Button asChild className="w-full font-bold shadow-lg h-11 px-8 bg-primary hover:bg-primary/90 transition-all uppercase tracking-widest text-[10px]">
            <Link href="/dashboard/maintenance">
                <PlusCircle className="mr-2 h-4 w-4" /> Record New Maintenance Issue
            </Link>
          </Button>
      </div>

      <AlertDialog open={!!logToCancel} onOpenChange={(open) => !open && setLogToCancel(null)}><AlertDialogContent className="rounded-2xl text-left"><AlertDialogHeader className="text-left"><AlertDialogTitle className="text-xl text-left font-headline">Cancel Maintenance Issue?</AlertDialogTitle><AlertDialogDescription className="text-base font-medium">This will mark "<strong className="text-foreground">{logToCancel?.title}</strong>" as 'Cancelled'.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-3 mt-4"><AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-xs h-11">Go Back</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-lg" onClick={handleCancelConfirm}>Confirm Cancellation</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}><AlertDialogContent className="rounded-2xl text-left"><AlertDialogHeader className="text-left"><AlertDialogTitle className="text-xl text-left font-headline">Permanent Deletion</AlertDialogTitle><AlertDialogDescription className="text-base font-medium text-destructive">Are you absolutely sure? This will permanently delete the record for "<strong className="text-foreground">{logToDelete?.title}</strong>". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-3 mt-4"><AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-xs h-11">Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-lg" onClick={handleDeleteConfirm}>Delete Permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
