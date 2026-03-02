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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  ArrowLeft, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Filter, 
  Banknote,
  LayoutList
} from 'lucide-react';
import { format, getYear, isSameYear } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, deleteDoc, limit } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Interfaces
interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
  status: string;
}

interface Expense {
  id: string;
  propertyId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  expenseType: string;
  amount: number;
  paidBy: string;
  notes?: string;
  ownerId: string;
}

const expenseSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Property required.'),
  date: z.coerce.date({ required_error: 'Please select a date.' }),
  expenseType: z.string({ required_error: 'Please select an expense type.' }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  paidBy: z.string().min(1, 'This field is required.'),
  notes: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

function safeToDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export default function LoggedExpensesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedYear, setSelectedYear] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // UseEffect to set initial year on client side only to prevent hydration mismatch
  useEffect(() => {
    setSelectedYear(getYear(new Date()));
  }, []);

  // Dialog States
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch properties
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);
  const { data: allProperties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

  const activeProperties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status || '')) ?? [];
  }, [allProperties]);

  // Fetch expenses for the selected property
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedPropertyId) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties', selectedPropertyId, 'expenses'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyId]);
  const { data: rawExpenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  // In-memory filter for selected year and search term
  const filteredExpenses = useMemo(() => {
    if (!rawExpenses || !selectedYear) return [];
    return rawExpenses.filter(exp => {
        const d = safeToDate(exp.date);
        const matchesYear = d && isSameYear(d, new Date(selectedYear, 0, 1));
        const matchesSearch = exp.expenseType.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             exp.paidBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (exp.notes?.toLowerCase() || '').includes(searchTerm.toLowerCase());
        return matchesYear && matchesSearch;
    }).sort((a,b) => {
        const dA = safeToDate(a.date) || new Date(0);
        const dB = safeToDate(b.date) || new Date(0);
        return dB.getTime() - dA.getTime();
    });
  }, [rawExpenses, selectedYear, searchTerm]);

  const editForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
  });

  useEffect(() => {
    if (editingExpense) {
        editForm.reset({
            propertyId: editingExpense.propertyId,
            expenseType: editingExpense.expenseType,
            amount: editingExpense.amount,
            paidBy: editingExpense.paidBy,
            notes: editingExpense.notes || '',
            date: safeToDate(editingExpense.date) || new Date(),
        });
    }
  }, [editingExpense, editForm]);

  const handleUpdate = async (data: ExpenseFormValues) => {
    if (!firestore || !editingExpense || !user) return;
    setIsSubmitting(true);
    const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', editingExpense.propertyId, 'expenses', editingExpense.id);
    
    updateDoc(docRef, { ...data })
      .then(() => {
        toast({ title: 'Record Updated', description: 'Expense record saved successfully.' });
        setEditingExpense(null);
      })
      .catch((err) => {
        console.error(err);
        toast({ variant: 'destructive', title: 'Update Failed' });
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleDelete = async () => {
    if (!firestore || !deletingExpense || !user) return;
    setIsSubmitting(true);
    const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', deletingExpense.propertyId, 'expenses', deletingExpense.id);
    
    deleteDoc(docRef)
      .then(() => {
        toast({ title: 'Record Deleted', description: 'The expense has been removed.' });
        setDeletingExpense(null);
      })
      .catch((err) => {
        console.error(err);
        toast({ variant: 'destructive', title: 'Delete Failed' });
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/expenses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">Logged Expenses</h1>
          <p className="text-muted-foreground">Detailed history of all financial outgoings.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select an active property and year to view recorded expenses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="property-filter">Property</Label>
                    <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                        <SelectTrigger id="property-filter">
                            <SelectValue placeholder={isLoadingProps ? "Loading..." : "Select a property"} />
                        </SelectTrigger>
                        <SelectContent>
                            {activeProperties.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                    {[p.address.nameOrNumber, p.address.street, p.address.city].filter(Boolean).join(', ')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="year-filter">Reporting Year</Label>
                    <Select value={selectedYear ? String(selectedYear) : ''} onValueChange={(v) => setSelectedYear(Number(v))}>
                        <SelectTrigger id="year-filter">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear()) - i).map(year => (
                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="space-y-2 pt-2">
                <Label htmlFor="search">Search Records</Label>
                <div className="relative max-w-2xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="search"
                        placeholder="Search by category, payer, or notes..." 
                        className="pl-10 h-11"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4 bg-muted/20">
            <CardTitle className="text-lg flex items-center gap-2">
                <LayoutList className="h-5 w-5 text-primary" />
                Expenditure Ledger
            </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
            {!selectedPropertyId ? (
                <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
                    <Filter className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p>Select a property to view its logged expenses.</p>
                </div>
            ) : isLoadingExpenses || !selectedYear ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredExpenses.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/5">
                    <Banknote className="h-10 w-10 mx-auto mb-4 opacity-20" />
                    <p>No expenses found for this selection.</p>
                </div>
            ) : (
                <div className="rounded-md border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Paid By</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExpenses.map((expense) => (
                                <TableRow key={expense.id} className="hover:bg-muted/20 transition-colors">
                                    <TableCell className="text-sm">
                                        {safeToDate(expense.date) ? format(safeToDate(expense.date)!, 'dd/MM/yyyy') : 'N/A'}
                                    </TableCell>
                                    <TableCell className="font-semibold text-sm">{expense.expenseType}</TableCell>
                                    <TableCell className="text-sm">{expense.paidBy}</TableCell>
                                    <TableCell className="text-right font-bold text-sm">{formatCurrency(expense.amount)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingExpense(expense)}><Eye className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingExpense(expense)}><Edit className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingExpense(expense)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
        {filteredExpenses.length > 0 && (
            <CardFooter className="flex justify-end bg-muted/10 border-t py-4">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Result:</span>
                    <span className="text-primary font-bold text-2xl">{formatCurrency(filteredExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0))}</span>
                </div>
            </CardFooter>
        )}
      </Card>

      {/* VIEW DIALOG */}
      <Dialog open={!!viewingExpense} onOpenChange={(open) => !open && setViewingExpense(null)}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Expense Record</DialogTitle>
                <DialogDescription>Viewing detailed information.</DialogDescription>
            </DialogHeader>
            {viewingExpense && (
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Amount</Label>
                            <p className="text-xl font-bold text-primary">{formatCurrency(viewingExpense.amount)}</p>
                        </div>
                        <div>
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Date</Label>
                            <p className="font-medium">{safeToDate(viewingExpense.date) ? format(safeToDate(viewingExpense.date)!, 'PPP') : 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Category</Label>
                        <p className="font-medium">{viewingExpense.expenseType}</p>
                    </div>
                    <div>
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Paid By</Label>
                        <p className="font-medium">{viewingExpense.paidBy}</p>
                    </div>
                    {viewingExpense.notes && (
                        <div>
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Notes</Label>
                            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md italic">"{viewingExpense.notes}"</p>
                        </div>
                    )}
                </div>
            )}
            <DialogFooter>
                <Button onClick={() => setViewingExpense(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT DIALOG */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>Update Record</DialogTitle>
                <DialogDescription>Modify the details for this expense.</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="date" render={({ field }) => (
                            <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={editForm.control} name="expenseType" render={({ field }) => (
                            <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={editForm.control} name="amount" render={({ field }) => (
                            <FormItem><FormLabel>Amount (£)</FormLabel><FormControl><Input type="text" inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={editForm.control} name="paidBy" render={({ field }) => (
                            <FormItem><FormLabel>Paid By</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <FormField control={editForm.control} name="notes" render={({ field }) => (
                        <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => setEditingExpense(null)}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      {/* DELETE ALERT */}
      <AlertDialog open={!!deletingExpense} onOpenChange={(open) => !open && setDeletingExpense(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will permanently delete the {deletingExpense?.expenseType} record of {deletingExpense ? formatCurrency(deletingExpense.amount) : ''}. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Permanently
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
