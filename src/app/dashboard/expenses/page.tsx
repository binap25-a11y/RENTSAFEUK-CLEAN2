
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
  FormDescription,
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
import { Label } from '@/components/ui/label';
import { 
  PoundSterling, 
  Loader2, 
  History,
  PlusCircle,
  Banknote,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { getYear, isAfter, isBefore } from 'date-fns';
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
import { collection, query, where, doc, setDoc, addDoc, limit } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Link from 'next/link';
import { safeToDate } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// UK Tax Year Month Sequence (April to March)
const TAX_MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'January', 'February', 'March'
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
  landlordId: string;
}

interface Expense {
  id: string;
  propertyId: string;
  landlordId: string;
  date: any;
  expenseType: string;
  amount: number;
  paidBy: string;
  notes?: string;
}

interface MaintenanceRepair {
    id: string;
    propertyId: string;
    landlordId: string;
    reportedDate: any;
    category: string;
    title: string;
    expectedCost?: number;
    estimatedCost?: number;
    status: string;
}

type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending';
interface RentPayment {
  id: string;
  propertyId: string;
  landlordId: string;
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
  const [selectedTaxYearStart, setSelectedTaxYearStart] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const taxYearStart = (now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6)) ? currentYear - 1 : currentYear;
    setSelectedTaxYearStart(taxYearStart);
  }, []);

  // 1. Fetch properties
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid), where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']), limit(500));
  }, [firestore, user]);
  const { data: activeProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  // 2. Fetch all expenses
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'expenses'), where('landlordId', '==', user.uid), limit(1000));
  }, [firestore, user]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  // 3. Fetch rent payments
  const rentQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedTaxYearStart) return null;
    return query(collection(firestore, 'rentPayments'), where('landlordId', '==', user.uid));
  }, [firestore, user, selectedTaxYearStart]);
  const { data: allRentPayments, isLoading: isLoadingRent } = useCollection<RentPayment>(rentQuery);

  // 4. Fetch maintenance repairs
  const repairsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'repairs'), where('landlordId', '==', user.uid), limit(500));
  }, [firestore, user]);
  const { data: allRepairs, isLoading: isLoadingRepairs } = useCollection<MaintenanceRepair>(repairsQuery);

  const selectedProperty = useMemo(() => {
    if (selectedPropertyId === 'all') return undefined;
    return activeProperties?.find(p => p.id === selectedPropertyId);
  }, [activeProperties, selectedPropertyId]);

  const taxBounds = useMemo(() => {
    if (!selectedTaxYearStart) return null;
    return {
        start: new Date(selectedTaxYearStart, 3, 6),
        end: new Date(selectedTaxYearStart + 1, 3, 5, 23, 59, 59)
    };
  }, [selectedTaxYearStart]);

  const expenses = useMemo(() => {
    if (!allExpenses || !taxBounds) return [];
    return allExpenses.filter(exp => {
        const d = safeToDate(exp.date);
        const matchesTaxYear = d && isAfter(d, taxBounds.start) && isBefore(d, taxBounds.end);
        const matchesProperty = selectedPropertyId === 'all' || exp.propertyId === selectedPropertyId;
        return matchesTaxYear && matchesProperty;
    });
  }, [allExpenses, selectedPropertyId, taxBounds]);

  const repairCosts = useMemo(() => {
    if (!allRepairs || !taxBounds) return [];
    return allRepairs.filter(r => {
        const d = safeToDate(r.reportedDate);
        const matchesTaxYear = d && isAfter(d, taxBounds.start) && isBefore(d, taxBounds.end);
        const matchesProperty = selectedPropertyId === 'all' || r.propertyId === selectedPropertyId;
        const hasCost = Number(r.expectedCost || r.estimatedCost || 0) > 0;
        return matchesTaxYear && matchesProperty && hasCost;
    });
  }, [allRepairs, selectedPropertyId, taxBounds]);

  const rentPayments = useMemo(() => {
    if (!allRentPayments || !selectedTaxYearStart) return [];
    return allRentPayments.filter(p => {
        const matchesProperty = selectedPropertyId === 'all' || p.propertyId === selectedPropertyId;
        const monthIdx = TAX_MONTHS.indexOf(p.month);
        const expectedCalYear = monthIdx >= 9 ? selectedTaxYearStart + 1 : selectedTaxYearStart;
        return matchesProperty && p.year === expectedCalYear;
    });
  }, [allRentPayments, selectedPropertyId, selectedTaxYearStart]);

  const totalExpectedRent = useMemo(() => {
    if (!selectedTaxYearStart) return 0;
    
    if (selectedPropertyId === 'all') {
        // consolidated calculation
        const baseExpected = activeProperties?.reduce((total, prop) => (total + (Number(prop.tenancy?.monthlyRent || 0) * 12)), 0) || 0;
        // Adjust for specific ledger entries that differ from base
        const overrides = rentPayments.reduce((acc, p) => acc + (Number(p.expectedAmount) - (activeProperties?.find(prop => prop.id === p.propertyId)?.tenancy?.monthlyRent || 0)), 0);
        return baseExpected + overrides;
    }
    
    const defaultRent = selectedProperty?.tenancy?.monthlyRent || 0;
    const paymentsMap = rentPayments.reduce((acc, p) => { acc[p.month] = p; return acc; }, {} as Record<string, RentPayment>);
    
    return TAX_MONTHS.reduce((acc, month) => {
        const amt = paymentsMap[month]?.expectedAmount ?? defaultRent;
        return acc + Number(amt);
    }, 0);
  }, [activeProperties, selectedPropertyId, selectedProperty, rentPayments, selectedTaxYearStart]);

  const totalPaidRent = useMemo(() => rentPayments.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0), [rentPayments]);
  
  const totalExpenses = useMemo(() => {
      const baseTotal = expenses.reduce((acc, expense) => acc + (Number(expense.amount) || 0), 0);
      const repairTotal = repairCosts.reduce((acc, r) => acc + (Number(r.expectedCost || r.estimatedCost || 0)), 0);
      return baseTotal + repairTotal;
  }, [expenses, repairCosts]);

  const netIncome = totalPaidRent - totalExpenses;
  
  const isLoading = isLoadingProperties || isLoadingExpenses || isLoadingRent || isLoadingRepairs || !selectedTaxYearStart;

  const generateHMRCPDF = async () => {
    if (!selectedTaxYearStart || !taxBounds) return;
    
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`HMRC Tax Report - ${selectedTaxYearStart}/${(selectedTaxYearStart + 1).toString().slice(-2)}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated for: ${user?.displayName || user?.email}`, 14, 30);
    doc.text(`Portfolio Scope: ${selectedPropertyId === 'all' ? 'Entire Portfolio' : formatAddress(selectedProperty?.address as any)}`, 14, 36);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 200, 40);

    const baseInsurance = expenses.filter(e => ['Insurance', 'Utilities'].includes(e.expenseType)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const baseMaintenance = expenses.filter(e => ['Repairs and Maintenance', 'Cleaning', 'Gardening'].includes(e.expenseType)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const repairMaintenance = repairCosts.reduce((a, b) => a + (Number(b.expectedCost || b.estimatedCost || 0)), 0);
    const totalMaintenance = baseMaintenance + repairMaintenance;
    const professionalFees = expenses.filter(e => ['Letting Agent Fees'].includes(e.expenseType)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const financeCosts = expenses.filter(e => ['Mortgage Interest'].includes(e.expenseType)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const otherExpenses = expenses.filter(e => e.expenseType === 'Other').reduce((a, b) => a + (Number(b.amount) || 0), 0);

    const hmrcCategories = [
        ['Rent received (total for period)', formatCurrency(totalPaidRent)],
        ['Rates, insurance, ground rents etc.', formatCurrency(baseInsurance)],
        ['Property repairs and maintenance', formatCurrency(totalMaintenance)],
        ['Management and professional fees', formatCurrency(professionalFees)],
        ['Other allowable property expenses', formatCurrency(otherExpenses)],
        ['Residential finance costs (Ref only)', formatCurrency(financeCosts)],
    ];

    autoTable(doc, { 
        startY: 45, 
        head: [['Standard HMRC Category Grouping', 'Total Amount (£)']], 
        body: hmrcCategories, 
        theme: 'striped',
        headStyles: { fillColor: [33, 114, 249] } 
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(9);
    doc.setTextColor(100);
    const note = "Note: Residential finance costs (Mortgage Interest) are listed for reference. Under Section 24, these are typically claimed as a 20% basic rate tax reduction rather than direct expenses.";
    doc.text(doc.splitTextToSize(note, 180), 14, finalY);

    doc.save(`HMRC-Tax-Report-${selectedTaxYearStart}-${selectedTaxYearStart + 1}.pdf`);
    toast({ title: 'Report Generated' });
  };

  function formatAddress(address: Property['address']) {
    if (!address) return 'N/A';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto text-left">
        <div className="flex flex-col gap-4 max-w-md bg-card p-6 rounded-lg border shadow-sm">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="financial-scope-selector" className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Registry View</Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="financial-scope-selector" className="h-11">
                        <SelectValue placeholder={isLoadingProperties ? "Syncing..." : "All Properties"} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Entire Portfolio (Consolidated)</SelectItem>
                        {activeProperties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
                            {formatAddress(prop.address)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid w-full gap-1.5">
                <Label htmlFor="reporting-year-selector" className="text-xs uppercase font-bold text-muted-foreground tracking-widest">UK Tax Year Cycle (12 Future, 5 Past)</Label>
                <Select onValueChange={(value) => setSelectedTaxYearStart(Number(value))} value={selectedTaxYearStart ? String(selectedTaxYearStart) : ''}>
                    <SelectTrigger id="reporting-year-selector" className="h-11">
                        <SelectValue placeholder="Tax Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {Array.from({ length: 18 }, (_, i) => (new Date().getFullYear() + 12) - i).map(year => (
                            <SelectItem key={year} value={String(year)}>{year} / {(year + 1).toString().slice(-2)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none shadow-md overflow-hidden text-left">
                <div className="h-1 bg-primary w-full" />
                <CardHeader className="pb-2 px-6"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gross Expected</CardTitle></CardHeader>
                <CardContent className='px-6 pb-6'><div className="text-2xl font-bold tracking-tight">{formatCurrency(totalExpectedRent)}</div></CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden text-left">
                <div className="h-1 bg-green-500 w-full" />
                <CardHeader className="pb-2 px-6"><CardTitle className="text-xs font-bold uppercase tracking-widest text-green-600">Verified Income</CardTitle></CardHeader>
                <CardContent className='px-6 pb-6'><div className="text-2xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(totalPaidRent)}</div></CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden text-left">
                <div className="h-1 bg-destructive w-full" />
                <CardHeader className="pb-2 px-6"><CardTitle className="text-xs font-bold uppercase tracking-widest text-destructive">Total Expenses</CardTitle></CardHeader>
                <CardContent className='px-6 pb-6'><div className="text-2xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(totalExpenses)}</div></CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden text-left">
                <div className="h-1 bg-amber-500 w-full" />
                <CardHeader className="pb-2 px-6"><CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Taxable Position</CardTitle></CardHeader>
                <CardContent className='px-6 pb-6'><div className={"text-2xl font-bold tracking-tight " + (netIncome < 0 ? "text-destructive" : "text-primary")}>{isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(netIncome)}</div></CardContent>
            </Card>
        </div>

        <Tabs defaultValue="expenses" className="pt-4">
            <TabsList className="bg-muted/50 p-1 h-auto rounded-xl">
                <TabsTrigger value="expenses" className="font-bold px-6 py-2 rounded-lg text-[10px] uppercase tracking-widest">Expense Tracker</TabsTrigger>
                <TabsTrigger value="summary" className="font-bold px-6 py-2 rounded-lg text-[10px] uppercase tracking-widest">HMRC Audit</TabsTrigger>
                <TabsTrigger value="statement" className="font-bold px-6 py-2 rounded-lg text-[10px] uppercase tracking-widest">Rent Ledger</TabsTrigger>
            </TabsList>
            <TabsContent value="expenses">
                <ExpenseTracker properties={activeProperties || []} selectedPropertyId={selectedPropertyId} />
            </TabsContent>
            <TabsContent value="summary">
                <div className="flex justify-end gap-2 mb-4 pt-4">
                  <Button onClick={generateHMRCPDF} size="sm" variant="outline" className="font-bold text-[10px] uppercase tracking-widest h-10 px-6 border-primary/20 bg-background shadow-md">
                    <PoundSterling className="mr-2 h-4 w-4 text-primary" /> Export HMRC Tax PDF
                  </Button>
                </div>
                <AnnualSummary selectedYear={selectedTaxYearStart || 0} expenses={expenses} repairCosts={repairCosts} isLoadingExpenses={isLoading} />
            </TabsContent>
            <TabsContent value="statement">
                <RentStatement 
                    selectedProperty={selectedProperty} 
                    selectedYear={selectedTaxYearStart || 0} 
                    rentPayments={rentPayments} 
                    isLoadingPayments={isLoading} 
                />
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
    const expCol = collection(firestore, 'expenses');
    addDoc(expCol, { ...data, landlordId: user.uid })
      .then(() => {
        toast({ title: 'Expense Logged' });
        form.reset({ propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : '', expenseType: '', notes: '', date: new Date(), paidBy: 'Landlord', amount: 0 });
      })
      .catch(() => toast({ variant: 'destructive', title: 'Save Failed' }))
      .finally(() => setIsSubmitting(false));
  }

  function formatAddress(address: Property['address']) {
    if (!address) return 'N/A';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  }

  return (
    <Card className="mt-6 border-none shadow-lg overflow-hidden text-left">
        <CardHeader className="bg-primary/5 border-b px-6">
            <CardTitle className="text-lg font-headline">Log New Financial Outgoing</CardTitle>
            <CardDescription>Record an allowable expense for tax reporting.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 px-6 pb-8">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="propertyId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="font-bold">Target Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Select from portfolio" /></SelectTrigger></FormControl>
                    <SelectContent>{properties.map(p => (<SelectItem key={p.id} value={p.id}>{formatAddress(p.address)}</SelectItem>))}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Date</FormLabel>
                      <FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="expenseType" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold">Tax Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                            <SelectContent>{['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees', 'Other'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold">Amount (£)</FormLabel><FormControl><Input type="number" step="0.01" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="paidBy" render={({ field }) => (<FormItem><FormLabel className="font-bold">Paid By</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel className="font-bold">Audit Notes</FormLabel><FormControl><Textarea className="rounded-xl min-h-[100px] resize-none" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={isSubmitting} className="w-full font-bold shadow-lg h-11 uppercase tracking-widest text-[10px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                Log Tax Record
            </Button>
            </form>
        </Form>
        </CardContent>
    </Card>
  );
}

function AnnualSummary({ selectedYear, expenses, repairCosts, isLoadingExpenses }: { selectedYear: number, expenses: Expense[], repairCosts: MaintenanceRepair[], isLoadingExpenses: boolean }) {
  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.expenseType] = (map[e.expenseType] || 0) + (Number(e.amount) || 0); });
    const totalRepairCost = repairCosts.reduce((acc, r) => acc + (Number(r.expectedCost || r.estimatedCost || 0)), 0);
    if (totalRepairCost > 0) map['Repairs and Maintenance'] = (map['Repairs and Maintenance'] || 0) + totalRepairCost;
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [expenses, repairCosts]);

  return (
    <Card className="mt-6 border-none shadow-lg overflow-hidden text-left">
        <CardHeader className="bg-primary/5 border-b border-primary/10 px-6">
            <CardTitle className="text-lg font-headline">Tax Year Audit: {selectedYear}/{ (selectedYear + 1).toString().slice(-2) }</CardTitle>
            <CardDescription>Consolidated outgoings by HMRC categories.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {isLoadingExpenses ? (<div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : expensesByCategory.length === 0 ? (<p className="py-16 text-center text-muted-foreground italic">No tax-allowable outgoings for this period.</p>) : (
                <Table>
                    <TableHeader className="bg-muted/50"><TableRow><TableHead className="pl-6 py-4 font-bold uppercase text-[10px]">HMRC Category Grouping</TableHead><TableHead className="text-right pr-6 font-bold uppercase text-[10px]">Total Outgoing</TableHead></TableRow></TableHeader>
                    <TableBody>{expensesByCategory.map(([name, amount]) => (<TableRow key={name}><TableCell className="font-bold pl-6 py-4">{name}</TableCell><TableCell className="text-right font-bold pr-6">{formatCurrency(amount)}</TableCell></TableRow>))}</TableBody>
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
    
    return TAX_MONTHS.map(month => {
        const monthIdx = TAX_MONTHS.indexOf(month);
        const calendarYear = monthIdx >= 9 ? selectedYear + 1 : selectedYear;
        return { 
            month, 
            year: calendarYear,
            rent: paymentsMap?.[month]?.expectedAmount ?? defaultRent, 
            amountPaid: paymentsMap?.[month]?.amountPaid ?? 0,
            status: paymentsMap?.[month]?.status || 'Pending' 
        };
    });
  }, [selectedProperty, rentPayments, selectedYear]);

  const collectionStats = useMemo(() => {
    const totalExpected = statement.reduce((acc, s) => acc + s.rent, 0);
    const totalCollected = statement.reduce((acc, s) => acc + s.amountPaid, 0);
    const remaining = totalExpected - totalCollected;
    const rate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    return { totalExpected, totalCollected, remaining, rate };
  }, [statement]);

  const handleStatusChange = (month: string, calendarYear: number, status: PaymentStatus) => {
    if (!firestore || !user || !selectedProperty) return;
    const rentPaymentId = `${selectedProperty.id}-${calendarYear}-${month}`;
    const row = statement.find(s => s.month === month && s.year === calendarYear);
    const expectedAmount = row?.rent ?? 0;
    
    // Automatically set amountPaid to expected amount if status is 'Paid'
    setDoc(doc(firestore, 'rentPayments', rentPaymentId), { 
        landlordId: user.uid, 
        propertyId: selectedProperty.id, 
        year: calendarYear, 
        month, 
        status, 
        expectedAmount, 
        amountPaid: status === 'Paid' ? expectedAmount : 0 
    }, { merge: true }).then(() => toast({ title: 'Ledger Updated' }));
  };

  const handleRentAmountChange = (month: string, calendarYear: number, amount: number) => {
    if (!firestore || !user || !selectedProperty || isNaN(amount)) return;
    const rentPaymentId = `${selectedProperty.id}-${calendarYear}-${month}`;
    const row = statement.find(s => s.month === month && s.year === calendarYear);
    const status = row?.status || 'Pending';
    
    setDoc(doc(firestore, 'rentPayments', rentPaymentId), {
        landlordId: user.uid,
        propertyId: selectedProperty.id,
        year: calendarYear,
        month,
        expectedAmount: amount,
        amountPaid: status === 'Paid' ? amount : 0
    }, { merge: true }).then(() => toast({ title: 'Expected Rent Updated' }));
  };

  if (!selectedProperty) return (
    <Card className="mt-6 border-dashed bg-muted/5 h-[400px] flex items-center justify-center">
        <CardContent className='text-center'>
            <div className="bg-background p-6 rounded-full w-fit mx-auto mb-4 border shadow-sm">
                <Banknote className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
            <p className="text-muted-foreground font-medium text-lg">Portfolio Asset Required</p>
            <p className="text-sm text-muted-foreground mt-1">Select a property from the registry view above to access the rent ledger.</p>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card className="border-none shadow-sm bg-primary/5 text-left">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Collected YTD</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-between pb-4">
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(collectionStats.totalCollected)}</span>
                    <ArrowUpRight className="h-5 w-5 text-green-600 opacity-20" />
                </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-primary/5 text-left">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Outstanding Balance</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-between pb-4">
                    <span className="text-2xl font-bold text-destructive">{formatCurrency(collectionStats.remaining)}</span>
                    <ArrowDownRight className="h-5 w-5 text-destructive opacity-20" />
                </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-primary/5 text-left">
                <CardHeader className="pb-2"><CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Collection Rate</CardTitle></CardHeader>
                <CardContent className="flex items-center justify-between pb-4">
                    <span className="text-2xl font-bold">{collectionStats.rate.toFixed(1)}%</span>
                    <TrendingUp className="h-5 w-5 text-primary opacity-20" />
                </CardContent>
            </Card>
        </div>

        <Card className="border-none shadow-lg overflow-hidden text-left">
            <CardHeader className="bg-primary/5 border-b border-primary/10 px-6">
                <CardTitle className="text-lg font-headline flex items-center justify-between">
                    Monthly Rent Ledger: {selectedYear}/{ (selectedYear + 1).toString().slice(-2) }
                    <Badge variant="outline" className="text-[9px] uppercase tracking-widest bg-background">{selectedProperty.address.street}</Badge>
                </CardTitle>
                <CardDescription>Verified chronological registry of rent collection status and overrides.</CardDescription>
            </CardHeader>
            <CardContent className='p-0'>
                {isLoadingPayments ? (
                    <div className="p-24 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6 py-4 font-bold uppercase text-[10px] tracking-wider">Accounting Period</TableHead>
                                    <TableHead className="font-bold uppercase text-[10px] tracking-wider">Expected Rent (£)</TableHead>
                                    <TableHead className="font-bold uppercase text-[10px] tracking-wider">Status</TableHead>
                                    <TableHead className="pr-6 font-bold uppercase text-[10px] tracking-wider text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statement.map((row) => (
                                    <TableRow key={`${row.month}-${row.year}`} className="hover:bg-muted/10 transition-colors group">
                                        <TableCell className="font-bold pl-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm">{row.month}</span>
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{row.year}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="relative max-w-[120px]">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50 text-xs">£</span>
                                                <Input 
                                                    type="number" 
                                                    key={`rent-input-${row.month}-${row.year}-${row.rent}`}
                                                    defaultValue={row.rent} 
                                                    className="h-9 pl-6 font-mono text-sm font-bold bg-background border-dashed focus:border-solid transition-all"
                                                    onBlur={(e) => handleRentAmountChange(row.month, row.year, Number(e.target.value))}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant={row.status === 'Paid' ? 'default' : row.status === 'Unpaid' ? 'destructive' : 'secondary'}
                                                className={cn(
                                                    "text-[9px] uppercase font-bold px-3 h-6 gap-1.5 shadow-sm",
                                                    row.status === 'Paid' && "bg-green-100 text-green-800 border-green-200"
                                                )}
                                            >
                                                {row.status === 'Paid' && <CheckCircle2 className="h-3 w-3" />}
                                                {row.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <Select value={row.status} onValueChange={(v) => handleStatusChange(row.month, row.year, v as PaymentStatus)}>
                                                <SelectTrigger className="w-[160px] h-9 text-xs font-bold ml-auto shadow-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent align="end">
                                                    <SelectItem value="Paid" className="text-green-600 font-bold">Mark as Paid</SelectItem>
                                                    <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                                                    <SelectItem value="Unpaid" className="text-destructive">Unpaid / Overdue</SelectItem>
                                                    <SelectItem value="Pending">Payment Pending</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
            <CardFooter className="bg-muted/10 border-t py-6 px-6 flex justify-between items-center">
                <div className="flex gap-6">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Total Accrued</span>
                        <span className="text-lg font-bold">{formatCurrency(collectionStats.totalExpected)}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">Total Outstanding</span>
                        <span className="text-lg font-bold text-destructive">{formatCurrency(collectionStats.remaining)}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[9px] font-bold uppercase text-primary tracking-widest block mb-1">Fiscal Integrity Verified</span>
                    <Badge className="bg-primary text-primary-foreground font-bold tracking-tighter">Collection Audit: {collectionStats.rate.toFixed(0)}%</Badge>
                </div>
            </CardFooter>
        </Card>
    </div>
  );
}
