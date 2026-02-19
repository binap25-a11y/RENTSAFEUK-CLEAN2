
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
  History,
  Receipt,
  ArrowUpRight,
  Edit2,
  Clock
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
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
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

  const [portfolioExpenses, setPortfolioExpenses] = useState<Expense[]>([]);
  const [portfolioRentPayments, setPortfolioRentPayments] = useState<RentPayment[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);

  useEffect(() => {
    setSelectedYear(getYear(new Date()));
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid), limit(500));
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
    return query(collection(firestore, 'properties', selectedPropertyId, 'expenses'), where('ownerId', '==', user.uid));
  }, [firestore, user, selectedPropertyId]);
  
  const { data: rawExpenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  const rentPaymentsQuery = useMemoFirebase(() => {
    if (!user || !firestore || selectedPropertyId === 'all' || !selectedYear) return null;
    return query(collection(firestore, 'properties', selectedPropertyId, 'rentPayments'), where('ownerId', '==', user.uid), where('year', '==', selectedYear));
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
            const expPromises = activeProperties.map(p => getDocs(query(collection(firestore, 'properties', p.id, 'expenses'), where('ownerId', '==', user.uid))));
            const rentPromises = activeProperties.map(p => getDocs(query(collection(firestore, 'properties', p.id, 'rentPayments'), where('ownerId', '==', user.uid), where('year', '==', selectedYear))));
            const [expSnaps, rentSnaps] = await Promise.all([Promise.all(expPromises), Promise.all(rentPromises)]);
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
    return activeProperties.reduce((total, prop) => (total + (Number(prop.tenancy?.monthlyRent || 0) * 12)), 0);
  }, [activeProperties]);

  const totalPaidRent = useMemo(() => rentPayments.reduce((acc, p) => acc + Number(p.amountPaid || 0), 0), [rentPayments]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, expense) => acc + Number(expense.amount || 0), 0), [expenses]);
  const netIncome = totalPaidRent - totalExpenses;
  
  const isLoading = isLoadingProperties || !selectedYear || (selectedPropertyId !== 'all' ? (isLoadingExpenses || isLoadingPayments) : isAggregating);

  const generateHMRCPDF = () => {
    if (!selectedYear) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`HMRC Self-Assessment Export - ${selectedYear}`, 14, 22);
    const hmrcCategories = {
        'Rent received': totalPaidRent,
        'Property repairs and maintenance': expenses.filter(e => ['Repairs and Maintenance', 'Cleaning', 'Gardening'].includes(e.expenseType)).reduce((a, b) => a + b.amount, 0),
        'Other allowable property expenses': expenses.filter(e => e.expenseType === 'Other').reduce((a, b) => a + b.amount, 0),
    };
    const tableData = Object.entries(hmrcCategories).map(([label, value]) => [label, formatCurrency(value)]);
    doc.autoTable({ startY: 40, head: [['HMRC Category', 'Amount (£)']], body: tableData, theme: 'striped' });
    doc.save(`HMRC-Report-${selectedYear}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 max-w-md bg-card p-6 rounded-lg border shadow-sm">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="property-filter" className="text-xs uppercase font-bold text-muted-foreground">Selected Property</Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="property-filter" className="h-12"><SelectValue placeholder="All Properties" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Properties (Portfolio View)</SelectItem>
                        {activeProperties.map((prop) => (<SelectItem key={prop.id} value={prop.id}>{[prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ')}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid w-full gap-1.5">
                <Label htmlFor="year-filter" className="text-xs uppercase font-bold text-muted-foreground">Reporting Year</Label>
                <Select onValueChange={(value) => setSelectedYear(Number(value))} value={selectedYear ? String(selectedYear) : ''}>
                    <SelectTrigger id="year-filter" className="h-12"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 5 }, (_, i) => (new Date().getFullYear()) - i).map(year => (<SelectItem key={year} value={String(year)}>{year}</SelectItem>))}</SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Portfolio Gross</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(portfolioIncome)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Income Received</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalPaidRent)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Expenses</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalExpenses)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Position</CardTitle></CardHeader><CardContent><div className={"text-2xl font-bold " + (netIncome < 0 ? "text-destructive" : "text-primary")}>{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(netIncome)}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="expenses" className="pt-4">
            <TabsList className="bg-muted/50 p-1 h-auto"><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="summary">Summary</TabsTrigger><TabsTrigger value="investment">Yield</TabsTrigger><TabsTrigger value="statement">Rent Ledger</TabsTrigger></TabsList>
            <TabsContent value="expenses">
                <ExpenseTracker properties={activeProperties} selectedPropertyId={selectedPropertyId} isLoadingProperties={isLoadingProperties} />
            </TabsContent>
            <TabsContent value="summary">
                <div className="flex justify-end gap-2 mb-4"><Button onClick={generateHMRCPDF} size="sm" variant="outline"><Receipt className="mr-2 h-4 w-4" /> HMRC Tax Export</Button></div>
                <AnnualSummary selectedProperty={selectedProperty} selectedYear={selectedYear || 0} expenses={expenses} isLoadingExpenses={isLoading} totalPaidRent={totalPaidRent} totalExpenses={totalExpenses} netIncome={netIncome} />
            </TabsContent>
            <TabsContent value="investment">
                <InvestmentAnalytics properties={activeProperties} selectedPropertyId={selectedPropertyId} allExpenses={expenses} />
            </TabsContent>
            <TabsContent value="statement">
                <RentStatement selectedProperty={selectedProperty} selectedYear={selectedYear || 0} rentPayments={rawRentPayments} isLoadingPayments={isLoadingPayments} />
            </TabsContent>
        </Tabs>
    </div>
  );
}

function ExpenseTracker({ properties, selectedPropertyId, isLoadingProperties }: { properties: Property[], selectedPropertyId: string, isLoadingProperties: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { propertyId: (selectedPropertyId && selectedPropertyId !== 'all') ? selectedPropertyId : '', expenseType: '', paidBy: 'Landlord', notes: '' },
  });

  useEffect(() => { form.setValue('date', new Date()); }, [form]);
  useEffect(() => { if (selectedPropertyId && selectedPropertyId !== 'all') form.setValue('propertyId', selectedPropertyId); }, [selectedPropertyId, form]);

  function onSubmit(data: ExpenseFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);
    addDoc(collection(firestore, 'properties', data.propertyId, 'expenses'), { ...data, ownerId: user.uid })
      .then(() => {
        toast({ title: 'Expense Saved' });
        form.reset({ propertyId: data.propertyId, expenseType: '', notes: '', date: new Date(), paidBy: 'Landlord', amount: 0 });
      })
      .catch(() => toast({ variant: 'destructive', title: 'Save Failed' }))
      .finally(() => setIsSubmitting(false));
  }

  return (
    <Card className="mt-6">
        <CardHeader><CardTitle className="text-lg">Add New Expense</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="propertyId" render={({ field }) => (
                  <FormItem><FormLabel>Target Property</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select property'} /></SelectTrigger></FormControl><SelectContent>{properties.map(p => (<SelectItem key={p.id} value={p.id}>{[p.address.street, p.address.city].filter(Boolean).join(', ')}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="expenseType" render={({ field }) => (
                    <FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Amount (£)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="paidBy" render={({ field }) => (<FormItem><FormLabel>Paid By</FormLabel><FormControl><Input placeholder="e.g. Landlord" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Details..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="flex justify-end gap-2 pt-2">
                <Button asChild type="button" variant="outline"><Link href="/dashboard/expenses/logged"><History className="mr-2 h-4 w-4" /> History</Link></Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
              </div>
            </form>
          </Form>
        </CardContent>
    </Card>
  );
}

function AnnualSummary({ selectedProperty, selectedYear, expenses, isLoadingExpenses, totalPaidRent, totalExpenses, netIncome }: { selectedProperty: Property | undefined, selectedYear: number, expenses: Expense[], isLoadingExpenses: boolean, totalPaidRent: number, totalExpenses: number, netIncome: number }) {
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.expenseType] = (map[e.expenseType] || 0) + Number(e.amount); });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [expenses]);

  return (
    <div className="space-y-6 mt-6">
        <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
                <CardHeader className="bg-muted/20 border-b"><CardTitle className="text-base font-bold">Expense Breakdown</CardTitle></CardHeader>
                <CardContent className="pt-6">
                    {isLoadingExpenses ? (<div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>) : expensesByCategory.length === 0 ? (<p className="py-16 text-center text-muted-foreground italic">No records found for this year.</p>) : (
                        <Table><TableHeader className="bg-muted/50"><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                        <TableBody>{expensesByCategory.map(([name, amount]) => (<TableRow key={name}><TableCell className="font-semibold">{name}</TableCell><TableCell className="text-right font-bold">{formatCurrency(amount)}</TableCell></TableRow>))}</TableBody></Table>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

function InvestmentAnalytics({ properties, selectedPropertyId, allExpenses }: { properties: Property[], selectedPropertyId: string, allExpenses: Expense[] }) {
    const analysisProperties = useMemo(() => (selectedPropertyId === 'all' ? properties : properties.filter(p => p.id === selectedPropertyId)), [properties, selectedPropertyId]);
    if (analysisProperties.length === 0) return <Card className="mt-6"><CardContent className="p-10 text-center text-muted-foreground">No properties available for analysis.</CardContent></Card>;
    return (
        <div className="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
            {analysisProperties.map(prop => {
                const annualRent = (prop.tenancy?.monthlyRent || 0) * 12;
                const purchasePrice = prop.purchasePrice || 0;
                const grossYield = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;
                return (
                    <Card key={prop.id}><CardHeader className="bg-muted/30"><CardTitle className="text-sm truncate">{prop.address.street}</CardTitle></CardHeader>
                    <CardContent className="pt-6"><p className="text-[10px] font-bold uppercase text-muted-foreground">Gross Yield</p><p className="text-2xl font-bold text-primary">{grossYield.toFixed(2)}%</p></CardContent></Card>
                );
            })}
        </div>
    );
}

function RentStatement({ selectedProperty, selectedYear, rentPayments, isLoadingPayments }: { selectedProperty: Property | undefined, selectedYear: number, rentPayments: RentPayment[] | null, isLoadingPayments: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const statement = useMemo(() => {
    const defaultRent = selectedProperty?.tenancy?.monthlyRent || 0;
    const paymentsMap = rentPayments?.reduce((acc, p) => { acc[p.month] = p; return acc; }, {} as Record<string, RentPayment>);
    return MONTHS.map(month => ({ month, rent: paymentsMap?.[month]?.expectedAmount ?? defaultRent, status: paymentsMap?.[month]?.status || 'Pending' }));
  }, [selectedProperty, rentPayments]);

  const handleStatusChange = (month: string, status: PaymentStatus) => {
    if (!firestore || !user || !selectedProperty) return;
    const rentPaymentRef = doc(firestore, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const expectedAmount = statement.find(s => s.month === month)?.rent ?? 0;
    setDoc(rentPaymentRef, { ownerId: user.uid, propertyId: selectedProperty.id, year: selectedYear, month, status, expectedAmount, amountPaid: status === 'Paid' ? expectedAmount : 0 }, { merge: true }).then(() => toast({ title: 'Record Updated' }));
  };

  if (!selectedProperty) return <Card className="mt-6 border-dashed"><CardContent className='py-16 text-center text-muted-foreground'>Select property to view ledger.</CardContent></Card>;

  return (
    <Card className="mt-6"><CardHeader className="border-b bg-muted/20"><CardTitle className="text-lg">Portfolio Ledger</CardTitle></CardHeader>
    <CardContent className='pt-6'>{isLoadingPayments ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
        <Table><TableHeader className="bg-muted/30"><TableRow><TableHead>Month</TableHead><TableHead>Monthly Rent</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{statement.map((row) => (<TableRow key={row.month}><TableCell className="font-bold">{row.month}</TableCell><TableCell>{formatCurrency(row.rent)}</TableCell>
            <TableCell><Select value={row.status} onValueChange={(v) => handleStatusChange(row.month, v as PaymentStatus)}><SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Partially Paid">Partially Paid</SelectItem><SelectItem value="Unpaid">Unpaid</SelectItem><SelectItem value="Pending">Pending</SelectItem></SelectContent></Select></TableCell></TableRow>))}</TableBody></Table>
    )}</CardContent></Card>
  );
}
