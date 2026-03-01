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
  PoundSterling, 
  Loader2, 
  Receipt, 
  History,
  ArrowUpRight,
  PlusCircle,
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
} from '@/firebase';
import { collection, query, where, doc, setDoc, addDoc, limit, onSnapshot } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Constants
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
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
    if (!user || !firestore) return null;
    return query(collection(firestore, 'userProfiles', user.uid, 'properties'), where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']), limit(500));
  }, [firestore, user]);

  const { data: activeProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const selectedProperty = useMemo(() => {
    if (selectedPropertyId === 'all') return undefined;
    return activeProperties?.find(p => p.id === selectedPropertyId);
  }, [activeProperties, selectedPropertyId]);

  // Aggregated Listeners
  useEffect(() => {
    if (!user || !activeProperties || activeProperties.length === 0 || !selectedYear || !firestore) {
        setPortfolioExpenses([]);
        setPortfolioRentPayments([]);
        return;
    }

    setIsAggregating(true);
    const unsubs: (() => void)[] = [];
    const expensesMap: Record<string, Expense[]> = {};
    const rentMap: Record<string, RentPayment[]> = {};

    const updateState = () => {
        setPortfolioExpenses(Object.values(expensesMap).flat());
        setPortfolioRentPayments(Object.values(rentMap).flat());
        setIsAggregating(false);
    };

    activeProperties.forEach(p => {
        // Listen to Expenses
        unsubs.push(onSnapshot(collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'expenses'), (snap) => {
            expensesMap[p.id] = snap.docs.map(d => ({ id: d.id, ...d.data(), propertyId: p.id } as Expense));
            updateState();
        }));

        // Listen to Rent Payments
        unsubs.push(onSnapshot(query(collection(firestore, 'userProfiles', user.uid, 'properties', p.id, 'rentPayments'), where('year', '==', selectedYear)), (snap) => {
            rentMap[p.id] = snap.docs.map(d => ({ id: d.id, ...d.data(), propertyId: p.id } as RentPayment));
            updateState();
        }));
    });

    return () => unsubs.forEach(u => u());
  }, [user, activeProperties, firestore, selectedYear]);

  const expenses = useMemo(() => {
    if (!selectedYear) return [];
    const list = selectedPropertyId !== 'all' ? (portfolioExpenses.filter(e => e.propertyId === selectedPropertyId)) : portfolioExpenses;
    return list.filter(exp => {
        const d = safeToDate(exp.date);
        return d && isSameYear(d, new Date(selectedYear, 0, 1));
    });
  }, [portfolioExpenses, selectedPropertyId, selectedYear]);

  const rentPayments = useMemo(() => {
    return selectedPropertyId !== 'all' ? (portfolioRentPayments.filter(p => p.propertyId === selectedPropertyId)) : portfolioRentPayments;
  }, [portfolioRentPayments, selectedPropertyId]);

  const displayIncome = useMemo(() => {
    if (selectedPropertyId !== 'all' && selectedProperty) {
        return Number(selectedProperty.tenancy?.monthlyRent || 0) * 12;
    }
    return activeProperties?.reduce((total, prop) => (total + (Number(prop.tenancy?.monthlyRent || 0) * 12)), 0) || 0;
  }, [activeProperties, selectedPropertyId, selectedProperty]);

  const totalPaidRent = useMemo(() => rentPayments.reduce((acc, p) => acc + Number(p.amountPaid || 0), 0), [rentPayments]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, expense) => acc + Number(expense.amount || 0), 0), [expenses]);
  const netIncome = totalPaidRent - totalExpenses;
  
  const isLoading = isLoadingProperties || !selectedYear || isAggregating;

  const generateHMRCPDF = () => {
    if (!selectedYear) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`HMRC Self-Assessment Export - ${selectedYear}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated for: ${user?.displayName || user?.email}`, 14, 30);
    doc.text(`Portfolio Scope: ${selectedPropertyId === 'all' ? 'Entire Active Portfolio' : selectedProperty?.address.street}`, 14, 36);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 200, 40);

    const ratesInsurance = expenses.filter(e => ['Insurance', 'Utilities'].includes(e.expenseType)).reduce((a, b) => a + Number(b.amount || 0), 0);
    const maintenance = expenses.filter(e => ['Repairs and Maintenance', 'Cleaning', 'Gardening'].includes(e.expenseType)).reduce((a, b) => a + Number(b.amount || 0), 0);
    const professionalFees = expenses.filter(e => ['Letting Agent Fees'].includes(e.expenseType)).reduce((a, b) => a + Number(b.amount || 0), 0);
    const financeCosts = expenses.filter(e => ['Mortgage Interest'].includes(e.expenseType)).reduce((a, b) => a + Number(b.amount || 0), 0);
    const otherExpenses = expenses.filter(e => e.expenseType === 'Other').reduce((a, b) => a + Number(b.amount || 0), 0);

    const hmrcCategories = [
        ['Rent received (total for period)', formatCurrency(totalPaidRent)],
        ['Rates, council tax, insurance, ground rents etc.', formatCurrency(ratesInsurance)],
        ['Property repairs and maintenance', formatCurrency(maintenance)],
        ['Management fees and other professional fees', formatCurrency(professionalFees)],
        ['Other allowable property expenses', formatCurrency(otherExpenses)],
        ['Residential finance costs (for reference)', formatCurrency(financeCosts)],
    ];

    (doc as any).autoTable({ 
        startY: 45, 
        head: [['Standard HMRC Category Grouping', 'Total Amount (£)']], 
        body: hmrcCategories, 
        theme: 'striped',
        headStyles: { fillColor: [33, 114, 249] } 
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(9);
    doc.setTextColor(100);
    const note = "Note: Residential finance costs (Mortgage Interest) are listed for reference. Under UK law (Section 24), these are typically claimed as a 20% basic rate tax reduction on your overall return rather than as a direct expense against rental profit.";
    doc.text(doc.splitTextToSize(note, 180), 14, finalY);

    doc.save(`RentSafeUK-HMRC-Tax-Report-${selectedYear}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 max-w-md bg-card p-6 rounded-lg border shadow-sm">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="property-filter" className="text-xs uppercase font-bold text-muted-foreground">Scope View</Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="property-filter" className="h-12"><SelectValue placeholder="All Properties" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Properties (Portfolio View)</SelectItem>
                        {activeProperties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
                            {[prop.address.nameOrNumber, prop.address.street, prop.address.city, prop.address.postcode].filter(Boolean).join(', ')}
                          </SelectItem>
                        ))}
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
            <Card className="border-none shadow-md overflow-hidden"><div className="h-1 bg-primary w-full" /><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{selectedPropertyId === 'all' ? 'Portfolio Gross' : 'Property Gross'}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{formatCurrency(displayIncome)}</div></CardContent></Card>
            <Card className="border-none shadow-md overflow-hidden"><div className="h-1 bg-green-500 w-full" /><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-green-600">Income Received</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalPaidRent)}</div></CardContent></Card>
            <Card className="border-none shadow-md overflow-hidden"><div className="h-1 bg-destructive w-full" /><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-destructive">Expenses</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(totalExpenses)}</div></CardContent></Card>
            <Card className="border-none shadow-md overflow-hidden"><div className="h-1 bg-amber-500 w-full" /><CardHeader className="pb-2"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Net Position</CardTitle></CardHeader><CardContent><div className={"text-2xl font-bold tracking-tight " + (netIncome < 0 ? "text-destructive" : "text-primary")}>{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : formatCurrency(netIncome)}</div></CardContent></Card>
        </div>

        <Tabs defaultValue="expenses" className="pt-4">
            <TabsList className="bg-muted/50 p-1 h-auto"><TabsTrigger value="expenses">Tracker</TabsTrigger><TabsTrigger value="summary">Tax Summary</TabsTrigger><TabsTrigger value="statement">Rent Ledger</TabsTrigger></TabsList>
            <TabsContent value="expenses">
                <ExpenseTracker properties={activeProperties || []} selectedPropertyId={selectedPropertyId} />
            </TabsContent>
            <TabsContent value="summary">
                <div className="flex justify-end gap-2 mb-4 pt-4"><Button onClick={generateHMRCPDF} size="sm" variant="outline" className="font-bold text-xs uppercase tracking-widest"><Receipt className="mr-2 h-4 w-4" /> HMRC Tax Export (PDF)</Button></div>
                <AnnualSummary selectedYear={selectedYear || 0} expenses={expenses} isLoadingExpenses={isLoading} />
            </TabsContent>
            <TabsContent value="statement">
                <RentStatement selectedProperty={selectedProperty} selectedYear={selectedYear || 0} rentPayments={rentPayments} isLoadingPayments={isLoading} />
            </TabsContent>
        </Tabs>
    </div>
  );
}

function ExpenseTracker({ properties, selectedPropertyId }: { properties: Property[], selectedPropertyId: string }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { 
      propertyId: (selectedPropertyId && selectedPropertyId !== 'all') ? selectedPropertyId : '', 
      expenseType: '', 
      paidBy: 'Landlord', 
      notes: '' 
    },
  });

  useEffect(() => {
    if (selectedPropertyId && selectedPropertyId !== 'all') {
      form.setValue('propertyId', selectedPropertyId);
    }
  }, [selectedPropertyId, form]);

  useEffect(() => {
    form.setValue('date', new Date());
  }, [form]);

  function onSubmit(data: ExpenseFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);
    const expCol = collection(firestore, 'userProfiles', user.uid, 'properties', data.propertyId, 'expenses');
    addDoc(expCol, { ...data, ownerId: user.uid })
      .then(() => {
        toast({ title: 'Expense Logged' });
        form.reset({ propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : '', expenseType: '', notes: '', date: new Date(), paidBy: 'Landlord', amount: 0 });
      })
      .catch(() => toast({ variant: 'destructive', title: 'Save Failed' }))
      .finally(() => setIsSubmitting(false));
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <div className="space-y-6">
        <Card className="mt-6 border-none shadow-lg">
            <CardHeader>
            <CardTitle className="text-lg">Log New Financial Outgoing</CardTitle>
            <CardDescription>Select a property and category to record a new expense.</CardDescription>
            </CardHeader>
            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="propertyId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold">Target Property</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select from portfolio" /></SelectTrigger></FormControl>
                        <SelectContent>{properties.map(p => (<SelectItem key={p.id} value={p.id}>{formatAddress(p.address)}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold">Date</FormLabel><FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="expenseType" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-bold">Category</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold">Amount (£)</FormLabel><FormControl><Input type="number" step="0.01" className="h-11" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="paidBy" render={({ field }) => (<FormItem><FormLabel className="font-bold">Paid By</FormLabel><FormControl><Input placeholder="e.g. Landlord" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel className="font-bold">Audit Notes</FormLabel><FormControl><Textarea placeholder="Details for tax records..." className="rounded-xl min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </form>
            </Form>
            </CardContent>
        </Card>

        <div className="flex items-center gap-3 w-full px-1">
            <Button asChild variant="outline" className="flex-1 font-bold shadow-sm h-11 px-6 border-primary/20 hover:bg-primary/5 transition-all">
                <Link href="/dashboard/expenses/logged">
                    <History className="mr-2 h-4 w-4 text-primary" /> View History
                </Link>
            </Button>
            <Button 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={isSubmitting} 
                className="flex-1 font-bold shadow-lg h-11 px-8 bg-primary hover:bg-primary/90 transition-all"
            >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Log Expense Record
            </Button>
        </div>
    </div>
  );
}

function AnnualSummary({ selectedYear, expenses, isLoadingExpenses }: { selectedYear: number, expenses: Expense[], isLoadingExpenses: boolean }) {
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.expenseType] = (map[e.expenseType] || 0) + Number(e.amount); });
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [expenses]);

  return (
    <Card className="mt-6 border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-lg">Tax Year Summary: {selectedYear}</CardTitle>
            <CardDescription>Aggregated outgoings for self-assessment reporting.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
            {isLoadingExpenses ? (<div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : expensesByCategory.length === 0 ? (<p className="py-16 text-center text-muted-foreground italic">No expense data found for this period.</p>) : (
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow><TableHead className="font-bold text-[10px] uppercase tracking-wider">Category</TableHead><TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Total Outgoing</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>{expensesByCategory.map(([name, amount]) => (<TableRow key={name} className="hover:bg-muted/30 transition-colors"><TableCell className="font-bold">{name}</TableCell><TableCell className="text-right font-bold pr-6">{formatCurrency(amount)}</TableCell></TableRow>))}</TableBody>
                </Table>
            )}
        </CardContent>
    </Card>
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
    const rentPaymentRef = doc(firestore, 'userProfiles', user.uid, 'properties', selectedProperty.id, 'rentPayments', `${selectedYear}-${month}`);
    const expectedAmount = statement.find(s => s.month === month)?.rent ?? 0;
    setDoc(rentPaymentRef, { ownerId: user.uid, propertyId: selectedProperty.id, year: selectedYear, month, status, expectedAmount, amountPaid: status === 'Paid' ? expectedAmount : 0 }, { merge: true }).then(() => {
        toast({ title: 'Ledger Updated' });
    });
  };

  if (!selectedProperty) return <Card className="mt-6 border-dashed bg-muted/5"><CardContent className='py-24 text-center'><div className="bg-background p-4 rounded-full w-fit mx-auto shadow-sm mb-4"><PoundSterling className="h-10 w-10 text-muted-foreground opacity-20" /></div><p className="text-muted-foreground font-medium">Select a specific property to view its rent ledger.</p></CardContent></Card>;

  return (
    <Card className="mt-6 border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
            <CardTitle className="text-lg">Rent Ledger: {selectedYear}</CardTitle>
            <CardDescription>Track collection status month-by-month.</CardDescription>
        </CardHeader>
        <CardContent className='p-0'>{isLoadingPayments ? <div className="p-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow><TableHead className="pl-6 font-bold text-[10px] uppercase tracking-wider">Month</TableHead><TableHead className="font-bold text-[10px] uppercase tracking-wider">Expected Rent</TableHead><TableHead className="font-bold text-[10px] uppercase tracking-wider pr-6">Payment Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                    {statement.map((row) => (
                        <TableRow key={row.month} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-bold pl-6">{row.month}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(row.rent)}</TableCell>
                            <TableCell className="pr-6">
                                <Select value={row.status} onValueChange={(v) => handleStatusChange(row.month, v as PaymentStatus)}>
                                    <SelectTrigger className="w-[160px] h-9 text-xs font-bold shadow-none"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Paid">Paid</SelectItem>
                                        <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                                        <SelectItem value="Unpaid">Unpaid</SelectItem>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}</CardContent>
    </Card>
  );
}