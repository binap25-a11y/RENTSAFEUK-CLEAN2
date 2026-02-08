'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useMemo, useEffect } from 'react';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  PoundSterling, 
  TrendingDown, 
  TrendingUp, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Download, 
  Filter, 
  Banknote,
  AlertTriangle,
  PieChart as PieChartIcon,
  List,
  Clock,
  LayoutList,
  Eye,
  Edit,
  Trash2,
  Calendar
} from 'lucide-react';
import { getYear, format, isSameYear } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, query, where, doc, setDoc, addDoc, limit, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Pie, PieChart, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Extend the autoTable interface in jsPDF
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// TYPE DEFINITIONS

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
  tenancy?: {
    monthlyRent: number;
  };
  status: string;
  ownerId: string;
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

type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending';
interface RentPayment {
  id: string;
  propertyId: string;
  year: number;
  month: string;
  status: PaymentStatus;
  amountPaid?: number;
  expectedAmount: number;
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

export default function FinancialsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedYear, setSelectedYear] = useState(getYear(new Date()));

  // 1. Fetch properties
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const activeProperties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  const selectedProperty = useMemo(() => {
    return allProperties?.find(p => p.id === selectedPropertyId);
  }, [allProperties, selectedPropertyId]);

  // 2. Fetch all expenses for the property (Real-time updates)
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedPropertyId) return null;
    return query(
      collection(firestore, 'properties', selectedPropertyId, 'expenses'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyId]);
  
  const { data: rawExpenses, isLoading: isLoadingExpenses, error: expensesError } = useCollection<Expense>(expensesQuery);

  // In-memory filter for selected year to avoid composite index requirement
  const expenses = useMemo(() => {
    if (!rawExpenses) return [];
    return rawExpenses.filter(exp => {
        const d = safeToDate(exp.date);
        return d && isSameYear(d, new Date(selectedYear, 0, 1));
    });
  }, [rawExpenses, selectedYear]);

  // 3. Fetch rent payments
  const rentPaymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedPropertyId) return null;
    return query(
      collection(firestore, 'properties', selectedPropertyId, 'rentPayments'),
      where('ownerId', '==', user.uid),
      where('year', '==', selectedYear)
    );
  }, [firestore, user, selectedPropertyId, selectedYear]);
  const { data: rentPayments, isLoading: isLoadingPayments } = useCollection<RentPayment>(rentPaymentsQuery);

  // 4. Calculations
  const totalPaidRent = useMemo(() => {
    if (!rentPayments) return 0;
    return rentPayments.reduce((acc, p) => acc + Number(p.amountPaid || 0), 0);
  }, [rentPayments]);
  
  const totalExpenses = useMemo(() => {
    return expenses.reduce((acc, expense) => acc + Number(expense.amount || 0), 0);
  }, [expenses]);
  
  const netIncome = totalPaidRent - totalExpenses;

  const portfolioIncome = useMemo(() => {
    return activeProperties.reduce((total, prop) => {
        return total + (prop.tenancy?.monthlyRent || 0) * 12;
    }, 0);
  }, [activeProperties]);
  
  const isLoading = isLoadingProperties || isLoadingExpenses || isLoadingPayments;

  return (
    <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annual Portfolio Rent</CardTitle>
                <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(portfolioIncome)}</div>
                <p className="text-xs text-muted-foreground">{activeProperties.length} active properties</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annual Income Received</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {isLoading && selectedPropertyId ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : selectedPropertyId ? formatCurrency(totalPaidRent) : '£0.00'}
                    </div>
                    <div className="text-[10px] font-medium text-muted-foreground h-4 uppercase tracking-tight truncate">
                        {selectedProperty ? [selectedProperty.address.street].filter(Boolean).join(', ') : `Reporting Year ${selectedYear}`}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annual Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {isLoading && selectedPropertyId ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : selectedPropertyId ? formatCurrency(totalExpenses) : '£0.00'}
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground h-4 uppercase tracking-tight">Period: {selectedYear}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annual Net Position</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={"text-2xl font-bold " + (netIncome < 0 ? " text-destructive" : " text-primary")}>
                        {isLoading && selectedPropertyId ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : selectedPropertyId ? formatCurrency(netIncome) : '£0.00'}
                    </div>
                     <p className="text-[10px] font-medium text-muted-foreground h-4 uppercase tracking-tight">Net result for year</p>
                </CardContent>
            </Card>
        </div>

       <Card className='border-none shadow-none bg-transparent'>
        <CardContent className="p-0 space-y-4">
           <div className="flex flex-col gap-4 max-w-md bg-card p-6 rounded-lg border shadow-sm">
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="property-filter" className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                        <Filter className="h-3 w-3" />
                        Selected Property
                    </Label>
                    <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                        <SelectTrigger id="property-filter" className="w-full h-12 bg-background">
                        <SelectValue placeholder={isLoadingProperties ? "Loading portfolio..." : "Select an active property"} />
                        </SelectTrigger>
                        <SelectContent>
                        {activeProperties.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id}>
                                {[prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ')}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid w-full gap-1.5">
                    <Label htmlFor="year-filter" className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Reporting Year</Label>
                    <Select onValueChange={(value) => setSelectedYear(Number(value))} value={String(selectedYear)}>
                        <SelectTrigger id="year-filter" className="w-full h-12 bg-background">
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i).map(year => (
                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
           </div>

           {expensesError && (
               <Alert variant="destructive" className="mt-4">
                   <AlertTriangle className="h-4 w-4" />
                   <AlertTitle>Database Sync Error</AlertTitle>
                   <AlertDescription>{expensesError.message}</AlertDescription>
               </Alert>
           )}

           <Tabs defaultValue="expenses" className="pt-4">
              <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4 bg-muted/50 p-1 rounded-lg h-auto">
                <TabsTrigger value="expenses" className="py-2">Expenses</TabsTrigger>
                <TabsTrigger value="summary" className="py-2">Annual Summary</TabsTrigger>
                <TabsTrigger value="statement" className="py-2">Rent Statement</TabsTrigger>
                <TabsTrigger value="arrears" className="py-2">Arrears</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses" className="animate-in fade-in-50 duration-300">
                <ExpenseTracker 
                  properties={activeProperties} 
                  selectedPropertyId={selectedPropertyId} 
                  isLoadingProperties={isLoadingProperties}
                  selectedYear={selectedYear}
                  expenses={expenses}
                  isLoadingExpenses={isLoadingExpenses}
                />
              </TabsContent>
              <TabsContent value="summary" className="animate-in fade-in-50 duration-300">
                <AnnualSummary 
                    selectedProperty={selectedProperty} 
                    selectedYear={selectedYear}
                    expenses={expenses}
                    isLoadingExpenses={isLoadingExpenses}
                    rentPayments={rentPayments}
                    isLoadingPayments={isLoadingPayments}
                    portfolioIncome={portfolioIncome}
                    totalPaidRent={totalPaidRent}
                    totalExpenses={totalExpenses}
                    netIncome={netIncome}
                />
              </TabsContent>
              <TabsContent value="statement" className="animate-in fade-in-50 duration-300">
                <RentStatement 
                    selectedProperty={selectedProperty} 
                    selectedYear={selectedYear}
                    rentPayments={rentPayments}
                    isLoadingPayments={isLoadingPayments}
                />
              </TabsContent>
              <TabsContent value="arrears" className="animate-in fade-in-50 duration-300">
                <ArrearsManagement properties={activeProperties} />
              </TabsContent>
            </Tabs>
        </CardContent>
       </Card>
    </div>
  );
}

function ExpenseTracker({ properties, selectedPropertyId, isLoadingProperties, selectedYear, expenses, isLoadingExpenses }: { properties: Property[], selectedPropertyId: string, isLoadingProperties: boolean, selectedYear: number, expenses: Expense[], isLoadingExpenses: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dialog States
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      propertyId: selectedPropertyId || '',
      expenseType: '',
      paidBy: 'Landlord',
      notes: '',
      date: new Date(),
    },
  });

  const editForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
  });

  useEffect(() => {
    if (selectedPropertyId) {
        form.setValue('propertyId', selectedPropertyId);
    }
  }, [selectedPropertyId, form]);

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

  function onSubmit(data: ExpenseFormValues) {
    if (!user || !firestore) return;
    
    setIsSubmitting(true);
    const newExpense = { ...data, ownerId: user.uid };
    const expensesCollection = collection(firestore, 'properties', data.propertyId, 'expenses');
    
    // Non-blocking write for instant UI feedback
    addDoc(expensesCollection, newExpense)
      .then(() => {
        toast({ title: 'Expense Saved', description: 'Your new expense record has been successfully logged.' });
        form.reset({ 
            propertyId: data.propertyId, 
            expenseType: '', 
            amount: undefined as any, 
            notes: '',
            date: new Date(),
            paidBy: 'Landlord'
        });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: expensesCollection.path,
          operation: 'create',
          requestResourceData: newExpense,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Save Failed', description: serverError.message || 'Error saving expense.' });
      })
      .finally(() => setIsSubmitting(false));
  }

  const handleUpdate = async (data: ExpenseFormValues) => {
    if (!firestore || !editingExpense) return;
    setIsSubmitting(true);
    const docRef = doc(firestore, 'properties', editingExpense.propertyId, 'expenses', editingExpense.id);
    
    updateDoc(docRef, { ...data })
      .then(() => {
        toast({ title: 'Record Updated', description: 'Expense record saved successfully.' });
        setEditingExpense(null);
      })
      .catch(async (err) => {
        console.error(err);
        toast({ variant: 'destructive', title: 'Update Failed' });
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleDelete = async () => {
    if (!firestore || !deletingExpense) return;
    setIsSubmitting(true);
    const docRef = doc(firestore, 'properties', deletingExpense.propertyId, 'expenses', deletingExpense.id);
    
    deleteDoc(docRef)
      .then(() => {
        toast({ title: 'Record Deleted', description: 'The expense has been removed from your history.' });
        setDeletingExpense(null);
      })
      .catch(async (err) => {
        console.error(err);
        toast({ variant: 'destructive', title: 'Delete Failed' });
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Add New Expense</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control} name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProperties ? 'Loading portfolio...' : 'Select a property'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>{[prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control} 
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                            type="date"
                            value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                            onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control} name="expenseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees',].map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control} name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (£)</FormLabel>
                      <FormControl><Input type="text" inputMode="decimal" placeholder="0.00" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control} name="paidBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid By</FormLabel>
                      <FormControl><Input placeholder="e.g., Landlord, Management Company" {...field} value={field.value ?? ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control} name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Add description or reference details..." {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <LayoutList className='h-5 w-5 text-primary' />
            <CardTitle className="text-lg">Logged Expenses</CardTitle>
          </div>
          <CardDescription>Full history for {selectedYear}.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingExpenses ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            </div>
          ) : expenses.length === 0 ? (
              <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg bg-muted/10">
                  <Banknote className="h-10 w-10 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium">{selectedPropertyId ? 'No expenses found for this selection.' : 'Choose a property to view logs.'}</p>
              </div>
          ) : (
              <>
                  <div className="hidden rounded-md border md:block overflow-hidden">
                      <Table>
                      <TableHeader className="bg-muted/30"><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Paid By</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {expenses.sort((a,b) => {
                              const dA = safeToDate(a.date) || new Date(0);
                              const dB = safeToDate(b.date) || new Date(0);
                              return dB.getTime() - dA.getTime();
                          }).map((expense) => (
                          <TableRow key={expense.id} className="hover:bg-muted/20 transition-colors">
                              <TableCell className='text-sm'>{safeToDate(expense.date) ? format(safeToDate(expense.date)!, 'dd/MM/yyyy') : 'N/A'}</TableCell>
                              <TableCell className="font-semibold text-sm">{expense.expenseType}</TableCell>
                              <TableCell className='text-sm'>{expense.paidBy}</TableCell>
                              <TableCell className="text-right font-bold whitespace-nowrap text-sm">{formatCurrency(expense.amount)}</TableCell>
                              <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingExpense(expense)}><Eye className="h-4 w-4" /></Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingExpense(expense)}><Edit className="h-4 w-4" /></Button>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeletingExpense(expense)}><Trash2 className="h-4 w-4" /></Button>
                                  </div>
                              </TableCell>
                          </TableRow>
                          ))}
                      </TableBody>
                      </Table>
                  </div>
                  <div className="grid gap-4 md:hidden">
                      {expenses.map((expense) => (
                          <Card key={expense.id} className="shadow-none border-muted/60">
                              <CardHeader className="pb-2">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <CardTitle className="text-base font-bold">{expense.expenseType}</CardTitle>
                                          <CardDescription>{safeToDate(expense.date) ? format(safeToDate(expense.date)!, 'dd/MM/yyyy') : 'N/A'}</CardDescription>
                                      </div>
                                      <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingExpense(expense)}><Edit className="h-4 w-4" /></Button>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingExpense(expense)}><Trash2 className="h-4 w-4" /></Button>
                                      </div>
                                  </div>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm pt-0">
                                  <div className="flex justify-between items-center border-t pt-2">
                                      <span className="text-muted-foreground">Amount</span>
                                      <span className="font-bold">{formatCurrency(expense.amount)}</span>
                                  </div>
                                  <div className="flex justify-between items-center border-t pt-2">
                                      <span className="text-muted-foreground">Paid By</span>
                                      <span className="font-medium">{expense.paidBy}</span>
                                  </div>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              </>
          )}
        </CardContent>
        {expenses.length > 0 && (
            <CardFooter className="flex justify-end pt-4 border-t bg-muted/10">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total for selected year:</span>
                <span className="text-primary font-bold text-2xl">{formatCurrency(expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0))}</span>
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

function AnnualSummary({ 
    selectedProperty, 
    selectedYear,
    expenses,
    isLoadingExpenses,
    rentPayments,
    isLoadingPayments,
    portfolioIncome,
    totalPaidRent,
    totalExpenses,
    netIncome,
}: { 
    selectedProperty: Property | undefined, 
    selectedYear: number,
    expenses: Expense[],
    isLoadingExpenses: boolean,
    rentPayments: RentPayment[] | null,
    isLoadingPayments: boolean,
    portfolioIncome: number,
    totalPaidRent: number,
    totalExpenses: number,
    netIncome: number,
}) {

  const isLoading = isLoadingExpenses || isLoadingPayments;
  const chartColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const expensesByCategory = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    expenses.forEach(exp => {
      categoryMap[exp.expenseType] = (categoryMap[exp.expenseType] || 0) + Number(exp.amount || 0);
    });
    return Object.entries(categoryMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount], index) => ({
      name,
      amount,
      fill: chartColors[index % chartColors.length]
    }));
  }, [expenses]);

  const chartConfig = useMemo(() => {
    return expensesByCategory.reduce((acc, category) => {
        acc[category.name] = {
            label: category.name,
            color: category.fill,
        };
        return acc;
    }, {} as ChartConfig);
  }, [expensesByCategory]);
  
  const generatePDF = () => {
    if (!selectedProperty) {
      toast({ variant: "destructive", title: "Selection Required", description: "Please select a property to generate a report." });
      return;
    }
    const doc = new jsPDF();
    const addressString = [selectedProperty.address.nameOrNumber, selectedProperty.address.street, selectedProperty.address.city].filter(Boolean).join(', ');
    doc.setFontSize(20);
    doc.text(`Financial Summary for ${selectedYear}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Property: ${addressString}`, 14, 30);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);
    const summaryData = [
      ['Total Income Received', formatCurrency(totalPaidRent)],
      ['Total Expenses', formatCurrency(totalExpenses)],
      ['Net Position', formatCurrency(netIncome)],
    ];
    doc.autoTable({ startY: 40, head: [['Metric', 'Value']], body: summaryData, theme: 'striped', headStyles: { fillColor: [38, 102, 114] } });
    let finalY = (doc as any).lastAutoTable.finalY;
    if (expensesByCategory.length > 0) {
      doc.setFontSize(16);
      doc.text('Expense Category Breakdown', 14, finalY + 15);
      const expenseBody = expensesByCategory.map(cat => [cat.name, formatCurrency(cat.amount)]);
      doc.autoTable({ startY: finalY + 22, head: [['Category', 'Amount']], body: expenseBody, theme: 'grid' });
      finalY = (doc as any).lastAutoTable.finalY;
    }
    if (rentPayments && rentPayments.length > 0) {
      doc.setFontSize(16);
      doc.text('Monthly Rent Receipts', 14, finalY + 15);
      const rentBody = rentPayments.filter(p => p.status === 'Paid' || p.status === 'Partially Paid').map(p => [p.month, formatCurrency(p.amountPaid || 0), formatCurrency(p.expectedAmount), p.status]);
      if (rentBody.length > 0) {
        doc.autoTable({ startY: finalY + 22, head: [['Month', 'Paid', 'Expected', 'Status']], body: rentBody, theme: 'grid' });
      }
    }
    const safeAddress = addressString.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    doc.save(`Financial-Report-${safeAddress}-${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-6 mt-6">
        <div className='flex justify-end'>
            <Button onClick={generatePDF} disabled={!selectedProperty || isLoading} size="sm" className='shadow-sm'>
                <Download className="mr-2 h-4 w-4" />
                Export Statement (PDF)
            </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/10 shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Banknote className="h-3 w-3" /> Projected Gross
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(portfolioIncome)}</div>
                    <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-tight">Full Portfolio Estimate</p>
                </CardContent>
            </Card>
            <Card className="bg-muted/5 border-muted shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <TrendingDown className="h-3 w-3" /> Actual Outgoings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoadingExpenses ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>}
                    <div className="text-[10px] text-muted-foreground font-medium mt-1 truncate">
                        {selectedProperty ? [selectedProperty.address.street].filter(Boolean).join(', ') : 'No property selected'}
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-muted/5 border-muted shadow-none">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" /> Year-to-Date Net
                    </CardTitle>
                </CardHeader>
                <CardContent>
                     {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <div className={"text-2xl font-bold " + (netIncome < 0 ? "text-destructive" : "text-green-600")}>{formatCurrency(netIncome)}</div>}
                    <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-tight">Total Receipts Minus Expenses</p>
                </CardContent>
            </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3 overflow-hidden">
                <CardHeader className="border-b pb-4 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <List className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base font-bold">Expense Breakdown</CardTitle>
                    </div>
                    <CardDescription className="text-xs">Detailed totals per category for {selectedYear}.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    {isLoadingExpenses ? (
                        <div className="flex h-48 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : expensesByCategory.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                            <Banknote className="h-10 w-10 mx-auto mb-4 opacity-20" />
                            <p className="text-xs italic">{selectedProperty ? "No financial records found for this period." : "Choose a property from the filters above."}</p>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Category</TableHead>
                                        <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider">Total (£)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {expensesByCategory.map(cat => (
                                        <TableRow key={cat.name} className="hover:bg-muted/20 transition-colors">
                                            <TableCell className="font-semibold text-sm">{cat.name}</TableCell>
                                            <TableCell className="text-right font-bold whitespace-nowrap text-sm">{formatCurrency(cat.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
             <Card className="lg:col-span-2 overflow-hidden">
                <CardHeader className="border-b pb-4 bg-muted/20">
                    <div className="flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base font-bold">Spend Distribution</CardTitle>
                    </div>
                    <CardDescription className="text-xs">Visual overview of financial outgoings.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center min-h-[300px]">
                    {isLoadingExpenses ? (
                        <div className="flex h-[250px] w-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : expensesByCategory.length > 0 ? (
                        <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[280px]">
                            <PieChart>
                                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="amount" formatter={(value) => formatCurrency(Number(value))} />} />
                                <Pie data={expensesByCategory} dataKey="amount" nameKey="name" innerRadius={65} strokeWidth={8}>
                                    {expensesByCategory.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.fill} className="stroke-background outline-none focus:outline-none"/>)}
                                </Pie>
                                <ChartLegend content={<ChartLegendContent nameKey="name" />} className="mt-4 flex-wrap text-[10px]" />
                            </PieChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8">
                            <PieChartIcon className="h-12 w-12 text-muted-foreground opacity-10 mb-4" />
                            <p className="text-xs text-muted-foreground italic">Add expenses to visualize your distribution graph.</p>
                        </div>
                    )}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

function RentStatement({ selectedProperty, selectedYear, rentPayments, isLoadingPayments }: { selectedProperty: Property | undefined, selectedYear: number, rentPayments: RentPayment[] | null, isLoadingPayments: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{ month: string; expectedAmount: number } | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(selectedYear, i, 1).toLocaleString('default', { month: 'long' })), [selectedYear]);
  
  const statement = useMemo(() => {
    const rent = selectedProperty?.tenancy?.monthlyRent || 0;
    const paymentsMap = rentPayments?.reduce((acc, p) => { acc[p.month] = p; return acc; }, {} as Record<string, RentPayment>);
    return months.map(month => ({ month, rent, status: paymentsMap?.[month]?.status || 'Pending' }));
  }, [selectedProperty, months, rentPayments]);

  const handleSavePartialPayment = async () => {
    if (!firestore || !user || !selectedProperty || !editingPayment) return;
    const amount = Number(partialAmount);
    if (isNaN(amount) || amount <= 0 || amount >= editingPayment.expectedAmount) {
        toast({ variant: 'destructive', title: 'Invalid Amount', description: `Please enter a value between 0 and ${formatCurrency(editingPayment.expectedAmount)}.` });
        return;
    }
    const { month } = editingPayment;
    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const paymentData = { ownerId: user.uid, propertyId: selectedProperty.id, year: selectedYear, month, status: 'Partially Paid' as PaymentStatus, expectedAmount: editingPayment.expectedAmount, amountPaid: amount };
    setDoc(rentPaymentRef, paymentData, { merge: true }).then(() => {
      toast({ title: 'Status Updated', description: `Partial payment for ${month} has been recorded.` });
    }).catch(() => {
      toast({ variant: 'destructive', title: 'Database Error' });
    });
    setDialogOpen(false); setEditingPayment(null); setPartialAmount('');
  };

  const handleStatusChange = (month: string, status: PaymentStatus) => {
    if (!firestore || !user || !selectedProperty) return;
    const expectedAmount = selectedProperty.tenancy?.monthlyRent || 0;
    if (status === 'Partially Paid') {
        setEditingPayment({ month, expectedAmount }); setPartialAmount(''); setDialogOpen(true);
        return;
    }
    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const paymentData = { ownerId: user.uid, propertyId: selectedProperty.id, year: selectedYear, month, status, expectedAmount, amountPaid: status === 'Paid' ? expectedAmount : 0 };
    setDoc(rentPaymentRef, paymentData, { merge: true }).then(() => {
      toast({ title: 'Record Saved', description: `Rent for ${month} updated to ${status}.` });
    }).catch(() => {
      toast({ variant: 'destructive', title: 'Database Error' });
    });
  };

  const totalExpectedRent = (selectedProperty?.tenancy?.monthlyRent || 0) * 12;
  const totalPaid = useMemo(() => rentPayments?.reduce((acc, row) => acc + Number(row.amountPaid || 0), 0) || 0, [rentPayments]);
  
  const getRentStatusProps = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid': return { Icon: CheckCircle2, className: "text-green-600 border-green-200 bg-green-50" };
      case 'Partially Paid': return { Icon: AlertCircle, className: "text-yellow-600 border-yellow-200 bg-yellow-50" };
      case 'Unpaid': return { Icon: XCircle, className: "text-red-600 border-red-200 bg-red-50" };
      case 'Pending': default: return { Icon: Clock, className: "" };
    }
  };

  if (!selectedProperty) return <Card className="mt-6 shadow-none border-dashed"><CardContent className='pt-16 pb-16 text-center text-muted-foreground bg-muted/10'><Filter className="h-10 w-10 mx-auto mb-4 opacity-20" /><p className='text-sm italic'>Choose a property to access the full rent ledger.</p></CardContent></Card>;
  if (!selectedProperty.tenancy?.monthlyRent) return <Card className="mt-6 border-yellow-200 bg-yellow-50/30 shadow-none"><CardContent className="pt-16 pb-16 text-center"><Banknote className="h-10 w-10 mx-auto mb-4 text-yellow-600/40" /><p className="font-semibold text-yellow-800">No rent data configured</p><p className='text-xs text-muted-foreground mt-1'>Please update the property details to set the monthly expected rent.</p><Button asChild variant="outline" size="sm" className="mt-6 bg-background border-yellow-200 hover:bg-yellow-100"><Link href={`/dashboard/properties/${selectedProperty.id}/edit`}>Setup Property Ledger</Link></Button></CardContent></Card>;

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Partial Payment Details</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="amount" className="text-right font-medium">Amount (£)</Label><Input id="amount" type="text" inputMode="decimal" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} className="col-span-3" placeholder="0.00" /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSavePartialPayment}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="mt-6 overflow-hidden">
        <CardHeader className="border-b pb-4 bg-muted/20"><CardTitle className="text-lg flex items-center gap-2"><LayoutList className='h-5 w-5 text-primary' /> Portfolio Ledger</CardTitle></CardHeader>
        <CardContent className='pt-6'>
           {isLoadingPayments ? <div className="flex justify-center items-center h-48"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div> : (
            <>
                <div className="hidden rounded-md border md:block overflow-hidden">
                    <Table>
                    <TableHeader className="bg-muted/30"><TableRow><TableHead>Month</TableHead><TableHead>Monthly Rent</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {statement.map((row) => {
                        const { Icon, className } = getRentStatusProps(row.status);
                        return (
                            <TableRow key={row.month} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="font-bold text-sm">{row.month}</TableCell>
                            <TableCell className="text-sm font-medium">{formatCurrency(row.rent)}</TableCell>
                            <TableCell>
                                <Select value={row.status} onValueChange={(newStatus) => handleStatusChange(row.month, newStatus as PaymentStatus)}>
                                <SelectTrigger className={"w-[160px] h-9 text-xs font-bold " + className}><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /><SelectValue /></div></SelectTrigger>
                                <SelectContent><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Partially Paid">Partially Paid</SelectItem><SelectItem value="Unpaid">Unpaid</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent>
                                </Select>
                            </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                    </Table>
                </div>
                 <div className="grid gap-4 md:hidden">
                    {statement.map((row) => {
                        const { Icon, className } = getRentStatusProps(row.status);
                        return (
                            <Card key={row.month} className="shadow-none border-muted/60">
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-base font-bold">{row.month}</CardTitle><span className="text-base font-semibold">{formatCurrency(row.rent)}</span></CardHeader>
                                <CardContent>
                                    <Select value={row.status} onValueChange={(newStatus) => handleStatusChange(row.month, newStatus as PaymentStatus)}>
                                    <SelectTrigger className={"w-full font-bold text-xs " + className}><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><SelectValue /></div></SelectTrigger>
                                    <SelectContent><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Partially Paid">Partially Paid</SelectItem><SelectItem value="Unpaid">Unpaid</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        )})}
                </div>
            </>
          )}
        </CardContent>
        {selectedProperty && (
            <CardFooter className='flex-col items-end space-y-1 pt-6 border-t mt-4 bg-muted/10'>
                <div className="font-bold text-2xl text-primary">{formatCurrency(totalPaid)} Collected YTD</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Target for period: {formatCurrency(totalExpectedRent)}</div>
            </CardFooter>
        )}
      </Card>
    </>
  );
}

function ArrearsManagement({ properties }: { properties: Property[] }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [arrears, setArrears] = useState<RentPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [partialPaymentData, setPartialPaymentData] = useState<{ payment: RentPayment; amount: string } | null>(null);
  const currentYear = getYear(new Date());
  const currentMonth = format(new Date(), 'MMMM');

  const fetchArrears = async () => {
    if (!user || !firestore || properties.length === 0) return;
    setIsLoading(true);
    try {
      const results: RentPayment[] = [];
      const promises = properties.filter(p => p.status === 'Occupied').map(prop => {
        return getDocs(query(collection(firestore, 'properties', prop.id, 'rentPayments'), where('ownerId', '==', user.uid), where('year', '==', currentYear), where('month', '==', currentMonth)));
      });
      const snapshots = await Promise.all(promises);
      snapshots.forEach((snap, index) => {
        const occupiedProps = properties.filter(p => p.status === 'Occupied');
        const propertyId = occupiedProps[index].id;
        const data = snap.docs[0]?.data() as RentPayment | undefined;
        if (!data || (data.status !== 'Paid')) {
          results.push({ 
            id: snap.docs[0]?.id || `${currentYear}-${currentMonth}`, 
            propertyId, 
            year: currentYear, 
            month: currentMonth, 
            status: data?.status || 'Unpaid', 
            expectedAmount: data?.expectedAmount || properties.find(p => p.id === propertyId)?.tenancy?.monthlyRent || 0, 
            amountPaid: data?.amountPaid || 0 
          });
        }
      });
      setArrears(results);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchArrears(); }, [user, properties, firestore]);

  const handleUpdateStatus = async (payment: RentPayment, newStatus: PaymentStatus, amountPaid?: number) => {
    if (!firestore || !user) return;
    const rentPaymentRef = doc(firestore, 'properties', payment.propertyId, 'rentPayments', `${payment.year}-${payment.month}`);
    const updateData = { ...payment, ownerId: user.uid, status: newStatus, amountPaid: amountPaid ?? (newStatus === 'Paid' ? payment.expectedAmount : 0) };
    try { 
      await setDoc(rentPaymentRef, updateData, { merge: true }); 
      toast({ title: 'Record Saved' }); 
      fetchArrears(); 
    } catch (error) { 
      toast({ variant: 'destructive', title: 'Update Failed' }); 
    }
  };

  const handleSavePartial = async () => {
    if (!partialPaymentData) return;
    const amount = Number(partialPaymentData.amount);
    if (isNaN(amount) || amount <= 0 || amount >= partialPaymentData.payment.expectedAmount) { toast({ variant: 'destructive', title: 'Error', description: 'Invalid payment amount.' }); return; }
    await handleUpdateStatus(partialPaymentData.payment, 'Partially Paid', amount);
    setPartialPaymentData(null);
  };

  return (
    <div className="space-y-6 mt-6">
      <Dialog open={!!partialPaymentData} onOpenChange={(open) => !open && setPartialPaymentData(null)}>
        <DialogContent><DialogHeader><DialogTitle>Record Partial Collection</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
              <Label className='text-xs font-bold uppercase text-muted-foreground'>Collected Sum (£)</Label>
              <Input type="text" inputMode="decimal" placeholder="0.00" value={partialPaymentData?.amount || ''} onChange={(e) => setPartialPaymentData(prev => prev ? { ...prev, amount: e.target.value } : null)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPartialPaymentData(null)}>Cancel</Button><Button onClick={handleSavePartial}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="border-destructive/20 bg-destructive/5 shadow-none">
        <CardHeader className="border-b pb-4"><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Arrears Monitoring</CardTitle></CardHeader>
        <CardContent className="pt-6">
          {isLoading ? <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-destructive" /></div> : arrears.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-lg bg-background"><CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-50" /><p className="text-lg font-bold text-green-700">Portfolio is fully up-to-date</p><p className='text-sm text-muted-foreground mt-1'>All occupied properties have cleared their rent for {currentMonth}.</p></div>
          ) : (
            <div className="rounded-md border bg-background overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50"><TableRow><TableHead className='text-[10px] font-bold uppercase'>Property</TableHead><TableHead className='text-[10px] font-bold uppercase'>Monthly Rent</TableHead><TableHead className='text-[10px] font-bold uppercase'>Received</TableHead><TableHead className='text-[10px] font-bold uppercase'>Status</TableHead><TableHead className="text-right text-[10px] font-bold uppercase">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {arrears.map((row) => (
                    <TableRow key={row.propertyId} className='hover:bg-muted/10 transition-colors'>
                      <TableCell className="font-bold text-sm">{properties.find(p => p.id === row.propertyId)?.address.street}</TableCell>
                      <TableCell className="text-sm font-medium">{formatCurrency(row.expectedAmount)}</TableCell>
                      <TableCell className="text-destructive font-bold text-sm">{formatCurrency(row.amountPaid || 0)}</TableCell>
                      <TableCell><Badge variant={row.status === 'Partially Paid' ? 'secondary' : 'destructive'} className='text-[10px] font-bold'>{row.status}</Badge></TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" className='h-8 text-xs' onClick={() => setPartialPaymentData({ payment: row, amount: '' })}>Partial</Button><Button size="sm" className='h-8 text-xs' onClick={() => handleUpdateStatus(row, 'Paid')}>Clear Full</Button></div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}