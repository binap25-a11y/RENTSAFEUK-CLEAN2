'use client';

import { useState, useMemo } from 'react';
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
  ArrowLeft 
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// Types
interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
}

interface MaintenanceLog {
    id: string;
    propertyId: string;
    title: string;
    priority: string;
    status: string;
    reportedDate: { seconds: number; nanoseconds: number; } | Date;
}

export default function MaintenanceLoggedPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [logToCancel, setLogToCancel] = useState<MaintenanceLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<MaintenanceLog | null>(null);

  // Fetch properties for the dropdown
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop) => {
        acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  // Fetch maintenance logs for the selected property
  const maintenanceQuery = useMemoFirebase(() => {
    if (!user || !selectedPropertyFilter) return null;
    return query(
        collection(firestore, 'properties', selectedPropertyFilter, 'maintenanceLogs'),
        where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyFilter]);

  const { data: maintenanceLogs, isLoading: isLoadingLogs } = useCollection<MaintenanceLog>(maintenanceQuery);
  
  const filteredLogs = useMemo(() => {
    if (!maintenanceLogs) return [];
    if (!searchTerm) return maintenanceLogs;
    return maintenanceLogs.filter(log =>
        log.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [maintenanceLogs, searchTerm]);

  const handleStatusChange = async (logId: string, propertyId: string, newStatus: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'properties', propertyId, 'maintenanceLogs', logId), { status: newStatus });
      toast({ title: 'Status Updated' });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };

  const handleCancelConfirm = async () => {
    if (!firestore || !logToCancel) return;
    try {
      await updateDoc(doc(firestore, 'properties', logToCancel.propertyId, 'maintenanceLogs', logToCancel.id), { status: 'Cancelled' });
      toast({ title: 'Log Cancelled' });
    } catch (error) {
      console.error('Failed to cancel log:', error);
      toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
      setLogToCancel(null);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!firestore || !logToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'properties', logToDelete.propertyId, 'maintenanceLogs', logToDelete.id));
      toast({ title: 'Log Deleted' });
    } catch (error) {
      console.error('Failed to delete log:', error);
      toast({ variant: 'destructive', title: 'Delete Failed' });
    } finally {
      setLogToDelete(null);
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/maintenance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Maintenance Logged</h1>
          <p className="text-muted-foreground">
            View and manage your maintenance records.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Records</CardTitle>
          <CardDescription>Select a property to view its maintenance history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2">
                    <Label htmlFor="property-filter" className="sr-only">Filter by Property</Label>
                    <Select value={selectedPropertyFilter} onValueChange={setSelectedPropertyFilter}>
                        <SelectTrigger id="property-filter" className="w-full md:w-[300px]"><SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property'} /></SelectTrigger>
                        <SelectContent>{properties?.map(prop => (<SelectItem key={prop.id} value={prop.id}>{formatAddress(prop.address)}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by issue title..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            </div>
            
            <div className="hidden rounded-md border md:block">
                <Table>
                    <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Reported</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoadingLogs && <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>}
                        {!isLoadingLogs && filteredLogs?.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center">{selectedPropertyFilter ? 'No maintenance logs for this property.' : 'Select a property to view logs.'}</TableCell></TableRow>}
                        {filteredLogs?.map(log => (<TableRow key={log.id}><TableCell className="font-medium"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`} className="hover:underline">{log.title}</Link></TableCell><TableCell><Select value={log.status} onValueChange={(newStatus) => handleStatusChange(log.id, selectedPropertyFilter, newStatus)}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Set status" /></SelectTrigger><SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></TableCell><TableCell><Badge variant={getPriorityVariant(log.priority)}>{log.priority}</Badge></TableCell><TableCell>{log.reportedDate instanceof Date ? format(log.reportedDate, 'dd/MM/yyyy') : format(new Date(log.reportedDate.seconds * 1000), 'dd/MM/yyyy')}</TableCell><TableCell className="text-right"><Button asChild variant="ghost" size="icon"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`}><Eye className="h-4 w-4" /></Link></Button><Button asChild variant="ghost" size="icon"><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${selectedPropertyFilter}`}><Edit className="mr-2 h-4 w-4" /></Link></Button><Button variant="ghost" size="icon" onClick={() => setLogToCancel(log)}><XCircle className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => setLogToDelete(log)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>))}
                    </TableBody>
                </Table>
            </div>

            <div className="space-y-4 md:hidden">
              {isLoadingLogs ? <div className="flex justify-center items-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
              : filteredLogs?.length === 0 ? <div className="text-center py-10 text-muted-foreground">{selectedPropertyFilter ? 'No maintenance logs for this property.' : 'Select a property to view logs.'}</div>
              : (filteredLogs.map(log => (
                    <Card key={log.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-base pr-2"><Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`} className="hover:underline">{log.title}</Link></CardTitle>
                                    <CardDescription>{propertyMap[selectedPropertyFilter]}</CardDescription>
                                </div>
                                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`}><Eye className="mr-2 h-4 w-4" /> View</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${selectedPropertyFilter}`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem><DropdownMenuItem onClick={() => setLogToCancel(log)}><XCircle className="mr-2 h-4 w-4" /> Cancel Log</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" /> Delete Permanently</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Status</span><Select value={log.status} onValueChange={(newStatus) => handleStatusChange(log.id, selectedPropertyFilter, newStatus)}><SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Set status" /></SelectTrigger><SelectContent><SelectItem value="Open">Open</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div>
                            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Priority</span><Badge variant={getPriorityVariant(log.priority)}>{log.priority}</Badge></div>
                        </CardContent>
                        <CardFooter className="text-xs justify-end text-muted-foreground pt-4">Reported on {log.reportedDate instanceof Date ? format(log.reportedDate, 'dd/MM/yyyy') : format(new Date(log.reportedDate.seconds * 1000), 'dd/MM/yyyy')}</CardFooter>
                    </Card>)))}
            </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!logToCancel} onOpenChange={(open) => !open && setLogToCancel(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will cancel the maintenance log: "{logToCancel?.title}". This action can be undone by editing the log.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Back</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleCancelConfirm}>Yes, Cancel Log</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the maintenance log: "{logToDelete?.title}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteConfirm}>Delete Permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
