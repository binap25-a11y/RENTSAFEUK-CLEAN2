
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  PoundSterling, 
  TrendingDown, 
  TrendingUp, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Filter, 
  Banknote,
  AlertTriangle,
  PieChart as PieChartIcon,
  List,
  Clock,
  LayoutList,
  History,
  Edit2,
  Receipt,
  ArrowUpRight
} from 'lucide-react';
import { getYear, format, isSameYear, differenceInYears } from 'date-fns';
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
import { collection, query, where, doc, setDoc, addDoc, limit, getDocs } from 'firebase/firestore';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Constants
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  purchasePrice?: number;
  currentValuation?: number;
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
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Portfolio-wide aggregation state
  const [portfolioExpenses, setPortfolioExpenses] = useState<Expense[]>([]);
  const [portfolioRentPayments, setPortfolioRentPayments] = useState<RentPayment[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);

  useEffect(() => {
    setSelectedYear(getYear(new Date()));
  }, []);

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
    return allProperties?.filter(p => activeStatuses.includes(p.status || '')) ?? [];
  }, [allProperties]);

  const selectedProperty = useMemo(() => {
    if (selectedPropertyId === 'all') return undefined;
    return allProperties?.find(p => p.id === selectedPropertyId);
  }, [allProperties, selectedPropertyId]);

  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || selectedPropertyId === 'all') return null;
    return query(
      collection(firestore, 'properties', selectedPropertyId, 'expenses'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyId]);
  
  const { data: rawExpenses, isLoading: isLoadingExpenses, error: expensesError } = useCollection<Expense>(expensesQuery);

  const rentPaymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore || selectedPropertyId === 'all' || !selectedYear) return null;
    return query(
      collection(firestore, 'properties', selectedPropertyId, 'rentPayments'),
      where('ownerId', '==', user.uid),
      where('year', '==', selectedYear)
    );
  }, [firestore, user, selectedPropertyId, selectedYear]);
  const { data: rawRentPayments, isLoading: isLoadingPayments } = useCollection<RentPayment>(rentPaymentsQuery);

  useEffect(() => {
    if (!user || activeProperties.length === 0 || selectedPropertyId !== 'all' || !selectedYear) {
        setPortfolioExpenses([]);
        setPortfolioRentPayments([]);
        return;
    }

    const aggregateData = async () => {
        setIsAggregating(true);
        try {
            const expPromises = activeProperties.map(p => 
                getDocs(query(collection(firestore, 'properties', p.id, 'expenses'), where('ownerId', '==', user.uid)))
            );
            const rentPromises = activeProperties.map(p => 
                getDocs(query(collection(firestore, 'properties', p.id, 'rentPayments'), where('ownerId', '==', user.uid), where('year', '==', selectedYear)))
            );

            const [expSnaps, rentSnaps] = await Promise.all([
                Promise.all(expPromises),
                Promise.all(rentPromises)
            ]);

            setPortfolioExpenses(expSnaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense))));
            setPortfolioRentPayments(rentSnaps.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as RentPayment))));
        } catch (err) {
            console.error("Aggregation failed:", err);
        } finally {
            setIsAggregating(false);
        }
    };

    aggregateData();
  }, [user, activeProperties, firestore, selectedPropertyId, selectedYear]);

  const expenses = useMemo(() => {
    if (!selectedYear) return [];
    const list = selectedPropertyId !== 'all' ? (rawExpenses || []) : portfolioExpenses;
    return list.filter(exp => {
        const d = safeToDate(exp.date);
        return d && isSameYear(d, new Date(selectedYear, 0, 1));
    });
  }, [rawExpenses, portfolioExpenses, selectedPropertyId, selectedYear]);

  const rentPayments = useMemo(() => {
    return selectedPropertyId !== 'all' ? (rawRentPayments || []) : portfolioRentPayments;
  }, [rawRentPayments, portfolioRentPayments, selectedPropertyId]);

  const portfolioIncome = useMemo(() => {
    return activeProperties.reduce((total, prop) => {
        const rent = Number(prop.tenancy?.monthlyRent || 0);
        return total + (rent * 12);
    }, 0);
  }, [activeProperties]);

  const totalPaidRent = useMemo(() => {
    return rentPayments.reduce((acc, p) => acc + Number(p.amountPaid || 0), 0);
  }, [rentPayments]);
  
  const totalExpenses = useMemo(() => {
    return expenses.reduce((acc, expense) => acc + Number(expense.amount || 0), 0);
  }, [expenses]);
  
  const netIncome = totalPaidRent - totalExpenses;
  
  const isLoading = isLoadingProperties || !selectedYear || (selectedPropertyId !== 'all' ? (isLoadingExpenses || isLoadingPayments) : isAggregating);

  const generateHMRCPDF = () => {
    if (!selectedYear) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`HMRC Self-Assessment Export (SA105) - ${selectedYear}`, 14, 22);
    doc.setFontSize(10);
    doc.text('This report categorizes your expenses according to the UK Self-Assessment property section.', 14, 30);
    
    const hmrcCategories = {
        'Rent received': totalPaidRent,
        'Rent, rates, insurance, ground rent etc': expenses.filter(e => ['Insurance', 'Utilities'].includes(e.expenseType)).reduce((a, b) => a + b.amount, 0),
        'Property repairs and maintenance': expenses.filter(e => ['Repairs and Maintenance', 'Cleaning', 'Gardening'].includes(e.expenseType)).reduce((a, b) => a + b.amount, 0),
        'Loan interest and other financial costs': expenses.filter(e => e.expenseType === 'Mortgage Interest').reduce((a, b) => a + b.amount, 0),
        'Legal, management and other professional fees': expenses.filter(e => e.expenseType === 'Letting Agent Fees').reduce((a, b) => a + b.amount, 0),
        'Other allowable property expenses': expenses.filter(e => e.expenseType === 'Other').reduce((a, b) => a + b.amount, 0),
    };

    const tableData = Object.entries(hmrcCategories).map(([label, value]) => [label, formatCurrency(value)]);
    doc.autoTable({
        startY: 40,
        head: [['HMRC Category', 'Amount (£)']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [38, 102, 114] }
    });

    doc.save(`HMRC-Tax-Report-${selectedYear}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 max-w-md bg-card p-6 rounded-lg border shadow-sm">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="property-filter" className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    <Filter className="h-3" />
                    Selected Property
                </Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="property-filter" className="w-full h-12 bg-background">
                    <SelectValue placeholder={isLoadingProperties ? "Loading portfolio..." : "All Properties (Portfolio View)"} />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">All Properties (Portfolio View)</SelectItem>
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
                <Select onValueChange={(value) => setSelectedYear(Number(value))} value={selectedYear ? String(selectedYear) : ''}>
                    <SelectTrigger id="year-filter" className="w-full h-12 bg-background">
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
                        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(totalPaidRent)}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">{selectedYear}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annual Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(totalExpenses)}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">{selectedYear}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annual Net Position</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={"text-2xl font-bold " + (netIncome < 0 ? " text-destructive" : " text-primary")}>
                        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(netIncome)}
                    </div>
                     <p className="text-[10px] text-muted-foreground uppercase">Net result</p>
                </CardContent>
            </Card>
        </div>

       <Card className='border-none shadow-none bg-transparent'>
        <CardContent className="p-0 space-y-4">
           <Tabs defaultValue="expenses" className="pt-4">
              <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:grid-cols-5 bg-muted/50 p-1 rounded-lg h-auto">
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="investment">Yield & ROI</TabsTrigger>
                <TabsTrigger value="statement">Rent Ledger</TabsTrigger>
                <TabsTrigger value="arrears">Arrears</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses">
                <ExpenseTracker properties={activeProperties} selectedPropertyId={selectedPropertyId} isLoadingProperties={isLoadingProperties} />
              </TabsContent>
              <TabsContent value="summary">
                <div className="flex justify-end gap-2 mb-4">
                    <Button onClick={generateHMRCPDF} size="sm" variant="outline">
                        <Receipt className="mr-2 h-4 w-4" /> HMRC Tax Export
                    </Button>
                </div>
                <AnnualSummary 
                    selectedProperty={selectedProperty} 
                    selectedYear={selectedYear || 0}
                    expenses={expenses}
                    isLoadingExpenses={isLoading}
                    rentPayments={rentPayments}
                    isLoadingPayments={isLoading}
                    portfolioIncome={portfolioIncome}
                    totalPaidRent={totalPaidRent}
                    totalExpenses={totalExpenses}
                    netIncome={netIncome}
                />
              </TabsContent>
              <TabsContent value="investment">
                <InvestmentAnalytics properties={activeProperties} selectedPropertyId={selectedPropertyId} allExpenses={expenses} />
              </TabsContent>
              <TabsContent value="statement">
                <RentStatement selectedProperty={selectedProperty} selectedYear={selectedYear || 0} rentPayments={rawRentPayments} isLoadingPayments={isLoadingPayments} />
              </TabsContent>
              <TabsContent value="arrears">
                <ArrearsManagement properties={activeProperties} />
              </TabsContent>
            </Tabs>
        </CardContent>
       </Card>
    </div>
  );
}

function InvestmentAnalytics({ properties, selectedPropertyId, allExpenses }: { properties: Property[], selectedPropertyId: string, allExpenses: Expense[] }) {
    const analysisProperties = useMemo(() => {
        if (selectedPropertyId === 'all') return properties;
        return properties.filter(p => p.id === selectedPropertyId);
    }, [properties, selectedPropertyId]);

    if (analysisProperties.length === 0) return <Card className="mt-6"><CardContent className="p-10 text-center text-muted-foreground italic">No properties found for analysis.</CardContent></Card>;

    return (
        <div className="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
            {analysisProperties.map(prop => {
                const annualRent = (prop.tenancy?.monthlyRent || 0) * 12;
                const propExpenses = allExpenses.filter(e => e.propertyId === prop.id).reduce((a, b) => a + b.amount, 0);
                const purchasePrice = prop.purchasePrice || 0;
                const currentValuation = prop.currentValuation || purchasePrice;
                
                const grossYield = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;
                const netYield = purchasePrice > 0 ? ((annualRent - propExpenses) / purchasePrice) * 100 : 0;
                const capitalAppreciation = purchasePrice > 0 ? ((currentValuation - purchasePrice) / purchasePrice) * 100 : 0;

                return (
                    <Card key={prop.id} className="overflow-hidden">
                        <CardHeader className="bg-muted/30 pb-4">
                            <CardTitle className="text-sm truncate">{[prop.address.street, prop.address.city].filter(Boolean).join(', ')}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Gross Yield</p>
                                    <p className="text-2xl font-bold text-primary">{grossYield.toFixed(2)}%</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Net Yield</p>
                                    <p className="text-2xl font-bold text-green-600">{netYield.toFixed(2)}%</p>
                                </div>
                            </div>
                            <div className="border-t pt-4 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Capital Growth</span>
                                    <span className="font-bold text-primary flex items-center gap-1">
                                        <ArrowUpRight className="h-3 w-3" /> {capitalAppreciation.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Current Value</span>
                                    <span className="font-bold">{formatCurrency(currentValuation)}</span>
                                </div>
                            </div>
                        </CardContent>
                        {!prop.purchasePrice && (
                            <CardFooter className="bg-yellow-50 p-2 border-t">
                                <p className="text-[10px] text-yellow-800 text-center w-full">Update Purchase Price in Property Settings for accurate ROI.</p>
                            </CardFooter>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}

function ExpenseTracker({ properties, selectedPropertyId, isLoadingProperties }: { properties: Property[], selectedPropertyId: string, isLoadingProperties: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      propertyId: (selectedPropertyId && selectedPropertyId !== 'all') ? selectedPropertyId : '',
      expenseType: '',
      paidBy: 'Landlord',
      notes: '',
    },
  });

  useEffect(() => {
    form.setValue('date', new Date());
  }, [form]);

  useEffect(() => {
    if (selectedPropertyId && selectedPropertyId !== 'all') {
        form.setValue('propertyId', selectedPropertyId);
    } else {
        form.setValue('propertyId', '');
    }
  }, [selectedPropertyId, form]);

  function onSubmit(data: ExpenseFormValues) {
    if (!user || !firestore) return;
    
    setIsSubmitting(true);
    const newExpense = { ...data, ownerId: user.uid };
    const expensesCollection = collection(firestore, 'properties', data.propertyId, 'expenses');
    
    addDoc(expensesCollection, newExpense)
      .then(() => {
        toast({ title: 'Expense Saved', description: 'Expense record successfully logged.' });
        form.reset({ propertyId: data.propertyId, expenseType: '', notes: '', date: new Date(), paidBy: 'Landlord' });
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Save Failed' });
      })
      .finally(() => setIsSubmitting(false));
  }

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
                          <SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property'} />
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
                        <Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} />
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
                          {['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees', 'Other'].map((type) => (
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
                      <FormControl><Input placeholder="e.g., Landlord" {...field} value={field.value ?? ''} /></FormControl>
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
                    <FormControl><Textarea placeholder="Details..." {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button asChild type="button" variant="outline">
                    <Link href="/dashboard/expenses/logged">
                        <History className="mr-2 h-4 w-4" /> History
                    </Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
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
        acc[category.name] = { label: category.name, color: category.fill };
        return acc;
    }, {} as ChartConfig);
  }, [expensesByCategory]);
  
  const generatePDF = () => {
    if (!selectedProperty) {
      toast({ variant: "destructive", title: "Selection Required", description: "Select a property for this report." });
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
    doc.save(`Financial-Report-${selectedYear}.pdf`);
  };

  return (
    <div className="space-y-6 mt-6">
        <div className='flex justify-end'>
            <Button onClick={generatePDF} disabled={!selectedProperty || isLoading} size="sm">
                <Download className="mr-2 h-4 w-4" /> Export Report (PDF)
            </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">Projected Gross</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary">{formatCurrency(portfolioIncome)}</div>
                </CardContent>
            </Card>
            <Card className="bg-muted/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">Actual Outgoings</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>}
                </CardContent>
            </Card>
            <Card className="bg-muted/5">
                <CardHeader className="pb-2">
                    <CardTitle className="text-[10px] font-bold uppercase text-muted-foreground">Year-to-Date Net</CardTitle>
                </CardHeader>
                <CardContent>
                     {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <div className={"text-2xl font-bold " + (netIncome < 0 ? "text-destructive" : "text-green-600")}>{formatCurrency(netIncome)}</div>}
                </CardContent>
            </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
                <CardHeader className="border-b bg-muted/20">
                    <CardTitle className="text-base font-bold">Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : expensesByCategory.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground italic border-2 border-dashed rounded-lg">No records found.</div>
                    ) : (
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow><TableHead className="text-[10px] uppercase font-bold">Category</TableHead><TableHead className="text-right text-[10px] uppercase font-bold">Total</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {expensesByCategory.map(cat => (
                                        <TableRow key={cat.name}><TableCell className="font-semibold text-sm">{cat.name}</TableCell><TableCell className="text-right font-bold text-sm">{formatCurrency(cat.amount)}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
             <Card className="lg:col-span-2">
                <CardHeader className="border-b bg-muted/20">
                    <CardTitle className="text-base font-bold">Spend Distribution</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center min-h-[300px]">
                    {isLoading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    ) : expensesByCategory.length > 0 ? (
                        <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[280px]">
                            <PieChart>
                                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="amount" formatter={(value) => formatCurrency(Number(value))} />} />
                                <Pie data={expensesByCategory} dataKey="amount" nameKey="name" innerRadius={65} strokeWidth={8}>
                                    {expensesByCategory.map((entry) => <Cell key={`cell-${entry.name}`} fill={entry.fill} />)}
                                </Pie>
                                <ChartLegend content={<ChartLegendContent nameKey="name" />} className="mt-4 flex-wrap text-[10px]" />
                            </PieChart>
                        </ChartContainer>
                    ) : (
                        <p className="text-xs text-muted-foreground italic">Add expenses to view graph.</p>
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
  const [isPartialDialogOpen, setPartialDialogOpen] = useState(false);
  const [isRentDialogOpen, setRentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<{ month: string; expectedAmount: number } | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [newRentAmount, setNewRentAmount] = useState('');
  
  const statement = useMemo(() => {
    const defaultRent = selectedProperty?.tenancy?.monthlyRent || 0;
    const paymentsMap = rentPayments?.reduce((acc, p) => { acc[p.month] = p; return acc; }, {} as Record<string, RentPayment>);
    return MONTHS.map(month => ({ 
        month, 
        rent: paymentsMap?.[month]?.expectedAmount ?? defaultRent, 
        status: paymentsMap?.[month]?.status || 'Pending',
        rawPayment: paymentsMap?.[month]
    }));
  }, [selectedProperty, rentPayments]);

  const handleSavePartialPayment = async () => {
    if (!firestore || !user || !selectedProperty || !editingPayment) return;
    const amount = Number(partialAmount);
    if (isNaN(amount) || amount <= 0 || amount >= editingPayment.expectedAmount) return;
    const { month } = editingPayment;
    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const paymentData = { ownerId: user.uid, propertyId: selectedProperty.id, year: selectedYear, month, status: 'Partially Paid' as PaymentStatus, expectedAmount: editingPayment.expectedAmount, amountPaid: amount };
    setDoc(rentPaymentRef, paymentData, { merge: true }).then(() => {
      toast({ title: 'Status Updated' });
    });
    setPartialDialogOpen(false); setEditingPayment(null); setPartialAmount('');
  };

  const handleSaveExpectedRent = async () => {
    if (!firestore || !user || !selectedProperty || !editingPayment) return;
    const amount = Number(newRentAmount);
    if (isNaN(amount) || amount < 0) return;
    const { month } = editingPayment;
    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const existing = statement.find(s => s.month === month)?.rawPayment;
    const paymentData = { ownerId: user.uid, propertyId: selectedProperty.id, year: selectedYear, month, status: existing?.status || 'Pending' as PaymentStatus, expectedAmount: amount, amountPaid: existing?.amountPaid ?? 0 };
    setDoc(rentPaymentRef, paymentData, { merge: true }).then(() => {
      toast({ title: 'Rent Adjusted' });
    });
    setRentDialogOpen(false); setEditingPayment(null); setNewRentAmount('');
  };

  const handleStatusChange = (month: string, status: PaymentStatus) => {
    if (!firestore || !user || !selectedProperty) return;
    const existingEntry = statement.find(s => s.month === month);
    const expectedAmount = existingEntry?.rent ?? selectedProperty.tenancy?.monthlyRent ?? 0;
    if (status === 'Partially Paid') {
        setEditingPayment({ month, expectedAmount }); setPartialAmount(''); setPartialDialogOpen(true);
        return;
    }
    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const paymentData = { ownerId: user.uid, propertyId: selectedProperty.id, year: selectedYear, month, status, expectedAmount, amountPaid: status === 'Paid' ? expectedAmount : 0 };
    setDoc(rentPaymentRef, paymentData, { merge: true }).then(() => {
      toast({ title: 'Record Saved' });
    });
  };

  const totalExpectedRent = useMemo(() => statement.reduce((acc, row) => acc + row.rent, 0), [statement]);
  const totalPaid = useMemo(() => rentPayments?.reduce((acc, row) => acc + Number(row.amountPaid || 0), 0) || 0, [rentPayments]);
  
  const getRentStatusProps = (status: PaymentStatus) => {
    switch (status) {
      case 'Paid': return { Icon: CheckCircle2, className: "text-green-600 border-green-200 bg-green-50" };
      case 'Partially Paid': return { Icon: AlertCircle, className: "text-yellow-600 border-yellow-200 bg-yellow-50" };
      case 'Unpaid': return { Icon: AlertCircle, className: "text-red-600 border-red-200 bg-red-50" };
      case 'Pending': default: return { Icon: Clock, className: "" };
    }
  };

  if (!selectedProperty) return <Card className="mt-6 border-dashed"><CardContent className='py-16 text-center text-muted-foreground italic'><Filter className="h-10 w-10 mx-auto mb-4 opacity-20" />Select property to view ledger.</CardContent></Card>;

  return (
    <>
      <Dialog open={isPartialDialogOpen} onOpenChange={setPartialDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Partial Payment</DialogTitle></DialogHeader>
          <div className="py-4"><Label htmlFor="amount">Amount (£)</Label><Input id="amount" type="text" inputMode="decimal" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPartialDialogOpen(false)}>Cancel</Button><Button onClick={handleSavePartialPayment}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRentDialogOpen} onOpenChange={setRentDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Adjust Monthly Rent</DialogTitle></DialogHeader>
            <div className="py-4"><Label htmlFor="rent-amount">Expected (£)</Label><Input id="rent-amount" type="text" inputMode="decimal" value={newRentAmount} onChange={(e) => setNewRentAmount(e.target.value)} /></div>
            <DialogFooter><Button variant="outline" onClick={() => setRentDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveExpectedRent}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="mt-6">
        <CardHeader className="border-b bg-muted/20"><CardTitle className="text-lg">Portfolio Ledger</CardTitle></CardHeader>
        <CardContent className='pt-6'>
           {isLoadingPayments ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : (
            <div className="rounded-md border">
                <Table>
                <TableHeader className="bg-muted/30"><TableRow><TableHead>Month</TableHead><TableHead>Monthly Rent</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                    {statement.map((row) => {
                    const { Icon, className } = getRentStatusProps(row.status);
                    return (
                        <TableRow key={row.month}>
                        <TableCell className="font-bold text-sm">{row.month}</TableCell>
                        <TableCell className="text-sm">
                            <Button variant="ghost" size="sm" className="h-auto p-1 font-medium hover:bg-primary/10 transition-colors group" onClick={() => { setEditingPayment({ month: row.month, expectedAmount: row.rent }); setNewRentAmount(String(row.rent)); setRentDialogOpen(true); }}>
                                {formatCurrency(row.rent)}<Edit2 className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-50" />
                            </Button>
                        </TableCell>
                        <TableCell>
                            <Select value={row.status} onValueChange={(v) => handleStatusChange(row.month, v as PaymentStatus)}>
                            <SelectTrigger className={"w-[160px] h-9 text-xs font-bold " + className}><div className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /><SelectValue /></div></SelectTrigger>
                            <SelectContent><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Partially Paid">Partially Paid</SelectItem><SelectItem value="Unpaid">Unpaid</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent>
                            </Select>
                        </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
        {selectedProperty && (
            <CardFooter className='flex-col items-end border-t pt-6 bg-muted/10'>
                <div className="font-bold text-2xl text-primary">{formatCurrency(totalPaid)} Collected YTD</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase">Target: {formatCurrency(totalExpectedRent)}</div>
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
  const [period, setPeriod] = useState<{ year: number; month: string } | null>(null);

  useEffect(() => {
    setPeriod({ year: new Date().getFullYear(), month: format(new Date(), 'MMMM') });
  }, []);

  const fetchArrears = async () => {
    if (!user || !firestore || properties.length === 0 || !period) return;
    setIsLoading(true);
    try {
      const results: RentPayment[] = [];
      const occupiedProps = properties.filter(p => p.status === 'Occupied');
      const promises = occupiedProps.map(prop => getDocs(query(collection(firestore, 'properties', prop.id, 'rentPayments'), where('ownerId', '==', user.uid), where('year', '==', period.year), where('month', '==', period.month))));
      const snapshots = await Promise.all(promises);
      snapshots.forEach((snap, index) => {
        const propertyId = occupiedProps[index].id;
        const data = snap.docs[0]?.data() as RentPayment | undefined;
        if (!data || (data.status !== 'Paid')) {
          results.push({ 
            id: snap.docs[0]?.id || `${period.year}-${period.month}`, 
            propertyId, year: period.year, month: period.month, 
            status: data?.status || 'Unpaid', 
            expectedAmount: data?.expectedAmount || occupiedProps[index].tenancy?.monthlyRent || 0, 
            amountPaid: data?.amountPaid || 0 
          });
        }
      });
      setArrears(results);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchArrears(); }, [user, properties, firestore, period]);

  const handleUpdateStatus = async (payment: RentPayment, newStatus: PaymentStatus, amountPaid?: number) => {
    if (!firestore || !user) return;
    const rentPaymentRef = doc(firestore, 'properties', payment.propertyId, 'rentPayments', `${payment.year}-${payment.month}`);
    const updateData = { ...payment, ownerId: user.uid, status: newStatus, amountPaid: amountPaid ?? (newStatus === 'Paid' ? payment.expectedAmount : 0) };
    try { await setDoc(rentPaymentRef, updateData, { merge: true }); toast({ title: 'Record Saved' }); fetchArrears(); } catch (error) { toast({ variant: 'destructive', title: 'Update Failed' }); }
  };

  const handleSavePartial = async () => {
    if (!partialPaymentData) return;
    const amount = Number(partialPaymentData.amount);
    if (isNaN(amount) || amount <= 0 || amount >= partialPaymentData.payment.expectedAmount) return;
    await handleUpdateStatus(partialPaymentData.payment, 'Partially Paid', amount);
    setPartialPaymentData(null);
  };

  return (
    <div className="space-y-6 mt-6">
      <Dialog open={!!partialPaymentData} onOpenChange={(open) => !open && setPartialPaymentData(null)}>
        <DialogContent><DialogHeader><DialogTitle>Record Partial Collection</DialogTitle></DialogHeader>
          <div className="py-4"><Label>Collected Sum (£)</Label><Input type="text" inputMode="decimal" value={partialPaymentData?.amount || ''} onChange={(e) => setPartialPaymentData(prev => prev ? { ...prev, amount: e.target.value } : null)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPartialPaymentData(null)}>Cancel</Button><Button onClick={handleSavePartial}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="border-destructive/20 bg-destructive/5 shadow-none">
        <CardHeader className="border-b"><CardTitle className="text-destructive">Arrears Monitoring</CardTitle></CardHeader>
        <CardContent className="pt-6">
          {isLoading ? <Loader2 className="h-8 w-8 animate-spin text-destructive mx-auto" /> : arrears.length === 0 ? (
            <div className="text-center py-20 bg-background rounded-lg border-2 border-dashed"><CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-50" /><p className="font-bold text-green-700">Portfolio is up-to-date</p></div>
          ) : (
            <div className="rounded-md border bg-background overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50"><TableRow><TableHead>Property</TableHead><TableHead>Received</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {arrears.map((row) => (
                    <TableRow key={row.propertyId}>
                      <TableCell className="font-bold text-sm">{properties.find(p => p.id === row.propertyId)?.address.street}</TableCell>
                      <TableCell className="text-destructive font-bold text-sm">{formatCurrency(row.amountPaid || 0)}</TableCell>
                      <TableCell><Badge variant={row.status === 'Partially Paid' ? 'secondary' : 'destructive'}>{row.status}</Badge></TableCell>
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
