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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Clock, PoundSterling, TrendingDown, TrendingUp, Loader2, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, getYear, startOfYear, endOfYear } from 'date-fns';
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
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
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
import { Pie, PieChart, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend the autoTable interface in jsPDF
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// TYPE DEFINITIONS

// Main interface for a Property document from Firestore
interface Property {
  id: string;
  address: string;
  tenancy?: {
    monthlyRent: number;
  };
}

// Type for expense documents from Firestore
interface Expense {
  id:string;
  propertyId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  expenseType: string;
  amount: number;
  paidBy: string;
  notes?: string;
}

// Type for rent payment documents from Firestore
type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending';
interface RentPayment {
  id: string;
  year: number;
  month: string;
  status: PaymentStatus;
  amountPaid?: number;
  expectedAmount: number;
}


// Schema for the expense form
const expenseSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }),
  date: z.date({ required_error: 'Please select a date.' }),
  expenseType: z.string({ required_error: 'Please select an expense type.' }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  paidBy: z.string().min(1, 'This field is required.'),
  notes: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;


// MAIN COMPONENT
export default function FinancialsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedYear, setSelectedYear] = useState(getYear(new Date()));

  // Fetch all properties for the user
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
       where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const selectedProperty = useMemo(() => {
    return properties?.find(p => p.id === selectedPropertyId);
  }, [properties, selectedPropertyId]);


  return (
    <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Portfolio Gross Income (Annual)</CardTitle>
                <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">£{
                    (properties || []).reduce((total, prop) => {
                        return total + (prop.tenancy?.monthlyRent || 0) * 12;
                    }, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})
                }</div>
                <p className="text-xs text-muted-foreground">{properties?.length || 0} properties total</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">-</div>
                    <p className="text-xs text-muted-foreground">For selected property & year</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">-</div>
                    <p className="text-xs text-muted-foreground">Income minus expenses</p>
                </CardContent>
            </Card>
        </div>
       <Card>
        <CardHeader>
          <CardTitle>Financial Overview</CardTitle>
          <CardDescription>Select a property and year to view its detailed financials.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="flex flex-col sm:flex-row gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="property-filter">Property</Label>
                    <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                        <SelectTrigger id="property-filter" className="w-full sm:w-[300px]">
                        <SelectValue placeholder={isLoadingProperties ? "Loading..." : "Select a property"} />
                        </SelectTrigger>
                        <SelectContent>
                        {properties?.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id}>
                            {prop.address}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="year-filter">Year</Label>
                    <Select onValueChange={(value) => setSelectedYear(Number(value))} value={String(selectedYear)}>
                        <SelectTrigger id="year-filter" className="w-full sm:w-[120px]">
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
           <Tabs defaultValue="expenses">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="summary">Annual Summary</TabsTrigger>
                <TabsTrigger value="statement">Rent Statement</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses">
                <ExpenseTracker 
                  properties={properties || []} 
                  selectedPropertyId={selectedPropertyId} 
                  isLoadingProperties={isLoadingProperties}
                  selectedYear={selectedYear}
                />
              </TabsContent>
              <TabsContent value="summary">
                <AnnualSummary allProperties={properties || []} selectedProperty={selectedProperty} selectedYear={selectedYear} />
              </TabsContent>
              <TabsContent value="statement">
                <RentStatement selectedProperty={selectedProperty} selectedYear={selectedYear}/>
              </TabsContent>
            </Tabs>
        </CardContent>
       </Card>

    </div>
  );
}


// EXPENSE TRACKER COMPONENT
function ExpenseTracker({ properties, selectedPropertyId, isLoadingProperties, selectedYear }: { properties: Property[], selectedPropertyId: string, isLoadingProperties: boolean, selectedYear: number }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
      propertyId: selectedPropertyId || undefined,
    },
  });

  // Automatically update the form's propertyId when the global selection changes
  useMemo(() => {
    form.setValue('propertyId', selectedPropertyId);
  }, [selectedPropertyId, form]);

  // Fetch expenses for the selected property and year
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedPropertyId) return null;
    const startDate = startOfYear(new Date(selectedYear, 0, 1));
    const endDate = endOfYear(new Date(selectedYear, 0, 1));
    return query(
      collection(firestore, 'properties', selectedPropertyId, 'expenses'),
      where('ownerId', '==', user.uid),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
  }, [firestore, user, selectedPropertyId, selectedYear]);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  // Handle form submission
  async function onSubmit(data: ExpenseFormValues) {
    if (!user || !firestore) return;

    const newExpense = { ...data, ownerId: user.uid };

    try {
      const expensesCollection = collection(firestore, 'properties', data.propertyId, 'expenses');
      await addDocumentNonBlocking(expensesCollection, newExpense);
      toast({
        title: 'Expense Logged',
        description: 'The new expense has been successfully logged.',
      });
      form.reset({ ...form.getValues(), expenseType: '', amount: undefined, notes: '' });
    } catch (error) {
      console.error('Failed to log expense', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'There was an error saving the expense. Please try again.',
      });
    }
  }

  const totalExpenses = useMemo(() => {
    return expenses?.reduce((acc, expense) => acc + expense.amount, 0) || 0;
  }, [expenses]);

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader><CardTitle>Log New Expense</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control} name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>{prop.address}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control} name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={'outline'} className={cn('pl-3 text-left font-normal',!field.value && 'text-muted-foreground')}>
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control} name="expenseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expense Type</FormLabel>
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
                      <FormControl><Input type="number" placeholder="100.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control} name="paidBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid By</FormLabel>
                      <FormControl><Input placeholder="e.g., Landlord, Tenant" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control} name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Add any relevant notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end"><Button type="submit">Log Expense</Button></div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logged Expenses</CardTitle>
          <CardDescription>Expenses logged for the selected property in {selectedYear}.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingExpenses ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !expenses?.length ? (
              <div className="text-center text-muted-foreground py-10">
                  {selectedPropertyId ? 'No expenses logged for this property.' : 'Select a property to see expenses.'}
              </div>
          ) : (
              <>
                  {/* Desktop Table View */}
                  <div className="hidden rounded-md border md:block">
                      <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Paid By</TableHead><TableHead className="text-right">Amount (£)</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {expenses?.map((expense) => (
                          <TableRow key={expense.id}>
                              <TableCell>{format(expense.date instanceof Date ? expense.date : new Date(expense.date.seconds * 1000),'dd/MM/yyyy')}</TableCell>
                              <TableCell>{expense.expenseType}</TableCell>
                              <TableCell>{expense.paidBy}</TableCell>
                              <TableCell className="text-right font-medium">£{expense.amount.toFixed(2)}</TableCell>
                          </TableRow>
                          ))}
                      </TableBody>
                      </Table>
                  </div>
                  {/* Mobile Card View */}
                  <div className="grid gap-4 md:hidden">
                      {expenses.map((expense) => (
                          <Card key={expense.id}>
                              <CardHeader>
                                  <CardTitle className="text-base">{expense.expenseType}</CardTitle>
                                  <CardDescription>{format(expense.date instanceof Date ? expense.date : new Date(expense.date.seconds * 1000),'PPP')}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2 text-sm pt-0">
                                  <div className="flex justify-between items-center border-t pt-2">
                                      <span className="text-muted-foreground">Amount</span>
                                      <span className="font-medium">£{expense.amount.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center border-t pt-2">
                                      <span className="text-muted-foreground">Paid By</span>
                                      <span className="font-medium">{expense.paidBy}</span>
                                  </div>
                              </CardContent>
                              {expense.notes && (
                                  <CardFooter className="text-xs text-muted-foreground border-t pt-2 pb-2">
                                      <p className="line-clamp-2">{expense.notes}</p>
                                  </CardFooter>
                              )}
                          </Card>
                      ))}
                  </div>
              </>
          )}
        </CardContent>
        <CardFooter className="flex justify-end font-bold">
          <div className="flex items-center gap-4">
            <span>Total for {selectedYear}:</span>
            <span>£{totalExpenses.toFixed(2)}</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}


// ANNUAL SUMMARY COMPONENT
function AnnualSummary({ allProperties, selectedProperty, selectedYear }: { allProperties: Property[], selectedProperty: Property | undefined, selectedYear: number }) {
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch expenses for the selected property and year
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedProperty) return null;
    const startDate = startOfYear(new Date(selectedYear, 0, 1));
    const endDate = endOfYear(new Date(selectedYear, 0, 1));
    return query(
      collection(firestore, 'properties', selectedProperty.id, 'expenses'),
      where('ownerId', '==', user.uid),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
  }, [firestore, user, selectedProperty, selectedYear]);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

   // Fetch rent payments for the selected property and year
  const rentPaymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedProperty) return null;
    return query(
      collection(firestore, 'properties', selectedProperty.id, 'rentPayments'),
      where('year', '==', selectedYear)
    );
  }, [firestore, user, selectedProperty, selectedYear]);
  const { data: rentPayments, isLoading: isLoadingPayments } = useCollection<RentPayment>(rentPaymentsQuery);
  
  const portfolioIncome = useMemo(() => {
    return allProperties.reduce((total, prop) => {
        return total + (prop.tenancy?.monthlyRent || 0) * 12;
    }, 0);
  }, [allProperties]);

  const totalPaidRent = useMemo(() => {
    if (!rentPayments) return 0;
    return rentPayments.reduce((acc, p) => {
      return acc + (p.amountPaid || 0);
    }, 0);
  }, [rentPayments]);
  
  const selectedPropertyExpenses = useMemo(() => {
    return expenses?.reduce((total, exp) => total + exp.amount, 0) || 0;
  }, [expenses]);
  
  const selectedPropertyNet = totalPaidRent - selectedPropertyExpenses;
  const isLoading = isLoadingExpenses || isLoadingPayments;

  const chartColors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const expensesByCategory = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    expenses?.forEach(exp => {
      categoryMap[exp.expenseType] = (categoryMap[exp.expenseType] || 0) + exp.amount;
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
      toast({
        variant: "destructive",
        title: "Property Required",
        description: "Please select a property to generate a statement.",
      });
      return;
    }

    const doc = new jsPDF();
    let finalY = 0;

    // Header
    doc.setFontSize(20);
    doc.text(`Financial Summary for ${selectedYear}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Property: ${selectedProperty.address}`, 14, 30);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    // Summary Data
    const summaryData = [
      ['Total Income Received', `£${totalPaidRent.toFixed(2)}`],
      ['Total Expenses', `£${selectedPropertyExpenses.toFixed(2)}`],
      ['Net Income', `£${selectedPropertyNet.toFixed(2)}`],
    ];

    doc.autoTable({
      startY: 40,
      head: [['Summary', 'Amount']],
      body: summaryData,
      theme: 'striped',
      headStyles: { fillColor: [38, 102, 114] }, // A nice teal color
    });

    finalY = (doc as any).lastAutoTable.finalY;

    // Expenses Breakdown
    if (expensesByCategory.length > 0) {
      doc.setFontSize(16);
      doc.text('Expense Breakdown', 14, finalY + 15);

      const expenseBody = expensesByCategory.map(cat => [cat.name, `£${cat.amount.toFixed(2)}`]);

      doc.autoTable({
        startY: finalY + 22,
        head: [['Category', 'Total Amount']],
        body: expenseBody,
        theme: 'grid',
      });
      finalY = (doc as any).lastAutoTable.finalY;
    }

    // Rent Payments Breakdown
    if (rentPayments && rentPayments.length > 0) {
      doc.setFontSize(16);
      doc.text('Rent Payments Received', 14, finalY + 15);

      const rentBody = rentPayments
        .filter(p => p.status === 'Paid' || p.status === 'Partially Paid')
        .map(p => [
          p.month,
          `£${(p.amountPaid || 0).toFixed(2)}`,
          `£${p.expectedAmount.toFixed(2)}`,
          p.status,
        ]);

      if (rentBody.length > 0) {
        doc.autoTable({
          startY: finalY + 22,
          head: [['Month', 'Amount Paid', 'Expected', 'Status']],
          body: rentBody,
          theme: 'grid',
        });
      }
    }
    const safeAddress = selectedProperty.address.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    doc.save(`Financial-Statement-${safeAddress}-${selectedYear}.pdf`);
  };


  return (
    <div className="space-y-6 mt-6">
        <div className='flex justify-between items-center'>
            <h2 className="text-xl font-semibold">Annual Summary</h2>
            <Button onClick={generatePDF} disabled={!selectedProperty || isLoading}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
            </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Portfolio Income</CardTitle>
                <PoundSterling className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">£{portfolioIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                <p className="text-xs text-muted-foreground">{allProperties.length} properties total</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses ({selectedYear})</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {isLoadingExpenses ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">£{selectedPropertyExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>}
                    <p className="text-xs text-muted-foreground truncate">{selectedProperty ? selectedProperty.address : 'No property selected'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Net Income ({selectedYear})</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                     {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className={cn("text-2xl font-bold", selectedPropertyNet < 0 && "text-destructive")}>£{selectedPropertyNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>}
                    <p className="text-xs text-muted-foreground">Income minus expenses</p>
                </CardContent>
            </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Expense Breakdown by Category</CardTitle>
                    <CardDescription>For {selectedProperty ? selectedProperty.address : 'the selected property'} for {selectedYear}.</CardDescription>
                </CardHeader>
                <CardContent>
                <div className="rounded-md border">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingExpenses && <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin" /></TableCell></TableRow>}
                        {!isLoadingExpenses && expensesByCategory.length === 0 && <TableRow><TableCell colSpan={2} className="h-24 text-center">{selectedProperty ? "No expenses found." : "Please select a property."}</TableCell></TableRow>}
                        {expensesByCategory.map(cat => (
                        <TableRow key={cat.name}>
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell className="text-right">£{cat.amount.toFixed(2)}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Expense Distribution</CardTitle>
                    <CardDescription>Visual breakdown of expenses for {selectedYear}.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                    {isLoadingExpenses ? (
                        <div className="flex h-[250px] w-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : expensesByCategory.length > 0 ? (
                        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px]">
                        <PieChart>
                            <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel nameKey="amount" formatter={(value) => `£${Number(value).toFixed(2)}`} />}
                            />
                            <Pie
                                data={expensesByCategory}
                                dataKey="amount"
                                nameKey="name"
                                innerRadius={60}
                                strokeWidth={5}
                            >
                                {expensesByCategory.map((entry) => (
                                    <Cell key={`cell-${entry.name}`} fill={entry.fill} className="stroke-background"/>
                                ))}
                            </Pie>
                            <ChartLegend
                            content={<ChartLegendContent nameKey="name" />}
                            className="-mt-4"
                            />
                        </PieChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex h-[250px] w-full flex-col items-center justify-center text-center">
                        <p className="text-muted-foreground">
                            {selectedProperty ? "No expenses to visualize." : "Please select a property."}
                        </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}


// RENT STATEMENT COMPONENT
function RentStatement({ selectedProperty, selectedYear }: { selectedProperty: Property | undefined, selectedYear: number }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{ month: string; expectedAmount: number } | null>(null);
  const [partialAmount, setPartialAmount] = useState('');

  const rentPaymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedProperty) return null;
    return query(
      collection(firestore, 'properties', selectedProperty.id, 'rentPayments'),
      where('year', '==', selectedYear),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedProperty, selectedYear]);
  const { data: rentPayments, isLoading: isLoadingPayments } = useCollection<RentPayment>(rentPaymentsQuery);
  
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => format(new Date(selectedYear, i, 1), 'MMMM')), [selectedYear]);

  const statement = useMemo(() => {
    const rent = selectedProperty?.tenancy?.monthlyRent || 0;
    const paymentsMap = rentPayments?.reduce((acc, p) => {
      acc[p.month] = p;
      return acc;
    }, {} as Record<string, RentPayment>);

    return months.map(month => ({
      month,
      rent,
      status: paymentsMap?.[month]?.status || 'Pending'
    }));
  }, [selectedProperty, months, rentPayments]);
  
  const handleSavePartialPayment = async () => {
    if (!firestore || !user || !selectedProperty || !editingPayment) return;

    const amount = Number(partialAmount);
    if (isNaN(amount) || amount <= 0 || amount >= editingPayment.expectedAmount) {
        toast({
            variant: 'destructive',
            title: 'Invalid Amount',
            description: `Please enter an amount greater than 0 and less than the expected rent of £${editingPayment.expectedAmount.toFixed(2)}.`,
        });
        return;
    }

    const { month } = editingPayment;
    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    
    const paymentData = {
      ownerId: user.uid,
      year: selectedYear,
      month,
      status: 'Partially Paid' as PaymentStatus,
      expectedAmount: editingPayment.expectedAmount,
      amountPaid: amount,
    };
    
    setDoc(rentPaymentRef, paymentData, { merge: true }).then(() => {
      toast({
        title: 'Status Updated',
        description: `Partial payment for ${month} has been logged.`,
      });
    }).catch(error => {
      console.error("Error updating rent status: ", error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save the rent status. Please try again.',
      });
    });

    setDialogOpen(false);
    setEditingPayment(null);
    setPartialAmount('');
  };

  const handleStatusChange = (month: string, status: PaymentStatus) => {
    if (!firestore || !user || !selectedProperty) return;

    const expectedAmount = selectedProperty.tenancy?.monthlyRent || 0;

     if (status === 'Partially Paid') {
        setEditingPayment({ month, expectedAmount });
        setPartialAmount('');
        setDialogOpen(true);
        return;
    }

    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const amountPaid = status === 'Paid' ? expectedAmount : 0;

    const paymentData = {
      ownerId: user.uid,
      year: selectedYear,
      month,
      status,
      expectedAmount,
      amountPaid,
    };
    
    setDoc(rentPaymentRef, paymentData, { merge: true }).then(() => {
      toast({
        title: 'Status Updated',
        description: `Rent for ${month} marked as ${status}.`,
      });
    }).catch(error => {
      console.error("Error updating rent status: ", error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save the rent status. Please try again.',
      });
    });
  };

  const totalExpectedRent = (selectedProperty?.tenancy?.monthlyRent || 0) * 12;

  const totalPaid = useMemo(() => {
    if (!rentPayments) return 0;
    return rentPayments.reduce((acc, row) => {
        return acc + (row.amountPaid || 0);
    }, 0);
  }, [rentPayments]);

  const getRentStatusProps = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid':
        return { Icon: CheckCircle2, className: "text-green-600 border-green-200 bg-green-50" };
      case 'Partially Paid':
        return { Icon: AlertCircle, className: "text-yellow-600 border-yellow-200 bg-yellow-50" };
      case 'Unpaid':
        return { Icon: XCircle, className: "text-red-600 border-red-200 bg-red-50" };
      case 'Pending':
      default:
        return { Icon: Clock, className: "" };
    }
  };
  
  const isLoading = isLoadingPayments;

  if (!selectedProperty) {
    return (
        <Card className="mt-6">
            <CardContent className='pt-6'>
                <p className="text-center text-muted-foreground">Please select a property to view its rent statement.</p>
            </CardContent>
        </Card>
    )
  }

  if (!selectedProperty.tenancy?.monthlyRent) {
     return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Rent Payment Statement</CardTitle>
                <CardDescription>For {selectedProperty.address}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-center text-muted-foreground">No tenancy or rent information available for this property.</p>
            </CardContent>
        </Card>
    )
  }


  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Partial Payment</DialogTitle>
            <DialogDescription>
              Log the partial amount paid for {editingPayment?.month} {selectedYear}. Expected rent is £{editingPayment?.expectedAmount.toFixed(2)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount (£)
              </Label>
              <Input
                id="amount"
                type="number"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                className="col-span-3"
                placeholder={`e.g., 500`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePartialPayment}>Save Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rent Payment Statement</CardTitle>
          <CardDescription>Expected monthly rent payments for {selectedProperty.address} for {selectedYear}.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
            <>
                {/* Desktop Table View */}
                <div className="hidden rounded-md border md:block">
                    <Table>
                    <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Expected Rent</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {statement.map((row) => {
                        const { Icon, className } = getRentStatusProps(row.status);
                        return (
                            <TableRow key={row.month}>
                            <TableCell className="font-medium">{row.month}</TableCell>
                            <TableCell>£{row.rent.toFixed(2)}</TableCell>
                            <TableCell>
                                <Select value={row.status} onValueChange={(newStatus) => handleStatusChange(row.month, newStatus as PaymentStatus)}>
                                <SelectTrigger className={cn("w-[150px]", className)}>
                                    <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    <SelectValue />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Paid">Paid</SelectItem>
                                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                </SelectContent>
                                </Select>
                            </TableCell>
                            </TableRow>
                        )
                        })}
                    </TableBody>
                    </Table>
                </div>
                {/* Mobile Card View */}
                 <div className="grid gap-4 md:hidden">
                    {statement.map((row) => {
                        const { Icon, className } = getRentStatusProps(row.status);
                        return (
                            <Card key={row.month}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base font-medium">{row.month}</CardTitle>
                                    <span className="text-base font-semibold">£{row.rent.toFixed(2)}</span>
                                </CardHeader>
                                <CardContent>
                                    <Select value={row.status} onValueChange={(newStatus) => handleStatusChange(row.month, newStatus as PaymentStatus)}>
                                    <SelectTrigger className={cn("w-full", className)}>
                                        <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                        <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                    </SelectContent>
                                    </Select>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </>
          )}
        </CardContent>
        <CardFooter className='flex-col items-end space-y-2 pt-6'>
            <div className="font-bold text-lg">
              Total Paid: £{totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <div className="text-muted-foreground">
              Total Expected Annual Rent: £{totalExpectedRent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
        </CardFooter>
      </Card>
    </>
  );
}
