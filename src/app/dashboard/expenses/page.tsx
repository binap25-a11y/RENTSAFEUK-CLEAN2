
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useMemo, useEffect, Suspense } from 'react';
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
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldCheck,
  Calendar,
  MapPin,
  Target,
  ChevronRight,
  User
} from 'lucide-react';
import { getYear, isAfter, isBefore, format, startOfMonth, setDate, isPast } from 'date-fns';
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
import { Progress } from '@/components/ui/progress';
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

interface Tenant {
    id: string;
    name: string;
    status: string;
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
    <Card className="mt-6 border-none shadow-2xl rounded-[2rem] overflow-hidden text-left bg-card">
        <CardHeader className="bg-primary/5 border-b px-8 py-8">
            <CardTitle className="text-xl font-headline flex items-center gap-3 text-primary"><PlusCircle className="h-6 w-6" /> Log New Financial Outgoing</CardTitle>
            <CardDescription className="text-base font-medium">Record an allowable expense for professional tax reporting.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 px-8 pb-8">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField control={form.control} name="propertyId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Target Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-12 bg-muted/5 border-2 rounded-xl"><SelectValue placeholder="Select from portfolio" /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-xl">{properties.map(p => (<SelectItem key={p.id} value={p.id} className="rounded-lg">{formatAddress(p.address)}</SelectItem>))}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Effective Date</FormLabel>
                      <FormControl><Input type="date" className="h-12 bg-muted/5 border-2 rounded-xl" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="expenseType" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Tax Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-muted/5 border-2 rounded-xl"><SelectValue placeholder="Select grouping" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl">{['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees', 'Other'].map(t => <SelectItem key={t} value={t} className="rounded-lg">{t}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Transaction Amount (£)</FormLabel><FormControl><Input type="number" step="0.01" className="h-12 bg-muted/5 border-2 rounded-xl font-bold text-lg" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="paidBy" render={({ field }) => (<FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Payer Reference</FormLabel><FormControl><Input className="h-12 bg-muted/5 border-2 rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Audit Notes</FormLabel><FormControl><Textarea className="rounded-2xl min-h-[120px] resize-none border-2 bg-muted/5" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <Button type="submit" disabled={isSubmitting} className="w-full font-bold shadow-2xl h-12 uppercase tracking-widest text-[11px] rounded-xl bg-primary hover:bg-primary/90 transition-all">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Sync Tax Record to Ledger
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
    <Card className="mt-6 border-none shadow-2xl rounded-[2rem] overflow-hidden text-left bg-card">
        <CardHeader className="bg-primary/5 border-b border-primary/10 px-8 py-8">
            <CardTitle className="text-xl font-headline flex items-center gap-3 text-foreground"><History className="h-6 w-6 text-primary" /> Tax Year Audit: {selectedYear}/{ (selectedYear + 1).toString().slice(-2) }</CardTitle>
            <CardDescription className="text-base font-medium">Verified consolidated outgoings mapped to standard HMRC categories.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {isLoadingExpenses ? (<div className="flex h-64 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>) : expensesByCategory.length === 0 ? (<div className="py-24 text-center text-muted-foreground italic flex flex-col items-center gap-4"><div className="p-6 rounded-full bg-muted/20"><AlertCircle className="h-10 w-10 opacity-20" /></div><p className="font-bold text-lg">No tax-allowable data detected.</p></div>) : (
                <div className="overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="pl-8 py-5 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Standard HMRC Category</TableHead>
                                <TableHead className="text-right pr-8 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Audit Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expensesByCategory.map(([name, amount]) => (
                                <TableRow key={name} className="hover:bg-primary/[0.02] transition-colors group">
                                    <TableCell className="font-bold pl-8 py-6 text-base group-hover:text-primary transition-colors">{name}</TableCell>
                                    <TableCell className="text-right font-bold pr-8 text-lg tabular-nums">{formatCurrency(amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
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
    const totalExpected = statement.reduce((acc, s) => acc + Number(s.rent), 0);
    const totalCollected = statement.reduce((acc, s) => acc + Number(s.amountPaid), 0);
    const remaining = totalExpected - totalCollected;
    const rate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;
    return { totalExpected, totalCollected, remaining, rate };
  }, [statement]);

  const handleStatusChange = (month: string, calendarYear: number, status: PaymentStatus) => {
    if (!firestore || !user || !selectedProperty) return;
    const rentPaymentId = `${selectedProperty.id}-${calendarYear}-${month}`;
    const row = statement.find(s => s.month === month && s.year === calendarYear);
    const expectedAmount = Number(row?.rent ?? 0);
    
    setDoc(doc(firestore, 'rentPayments', rentPaymentId), { 
        landlordId: user.uid, 
        propertyId: selectedProperty.id, 
        year: calendarYear, 
        month, 
        status, 
        expectedAmount, 
        amountPaid: status === 'Paid' ? expectedAmount : (status === 'Partially Paid' ? (Number(row?.amountPaid) || 0) : 0)
    }, { merge: true }).then(() => toast({ title: 'Registry Sync Successful' }));
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
        status,
        amountPaid: status === 'Paid' ? amount : (Number(row?.amountPaid) || 0)
    }, { merge: true }).then(() => toast({ title: 'Fiscal Expectation Adjusted' }));
  };

  if (!selectedProperty) return (
    <Card className="mt-6 border-2 border-dashed bg-muted/5 h-[450px] flex items-center justify-center rounded-[2rem]">
        <CardContent className='text-center space-y-6 max-w-xs'>
            <div className="bg-background p-8 rounded-full w-fit mx-auto shadow-2xl border-2 border-primary/10">
                <Banknote className="h-12 w-12 text-primary/30" />
            </div>
            <div className="space-y-2">
                <p className="text-foreground font-bold text-xl font-headline">Portfolio Context Required</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Please select a specific property from the registry view above to access the interactive rent ledger.</p>
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Card className="border-none shadow-xl bg-card text-left overflow-hidden group ring-1 ring-primary/5 min-h-[120px]">
                <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                    <CardTitle className="text-[11px] font-black uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="leading-tight">Verified Revenue Collected</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between pb-4 px-4 sm:pb-6 sm:px-6">
                    <div className="flex flex-col min-w-0">
                        <span className="text-xl sm:text-2xl font-bold text-green-600 tracking-tighter truncate">{formatCurrency(collectionStats.totalCollected)}</span>
                        <p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase mt-1 truncate leading-tight">Confirmed Registry Income</p>
                    </div>
                    <div className="p-2 sm:p-3 rounded-xl bg-green-50 text-green-600 shadow-inner group-hover:scale-110 transition-transform shrink-0"><ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" /></div>
                </CardContent>
            </Card>
            
            <Card className="border-none shadow-xl bg-card text-left overflow-hidden group ring-1 ring-destructive/5 min-h-[120px]">
                <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                    <CardTitle className="text-[11px] font-black uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        <span className="leading-tight">Total Outstanding Arrears</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between pb-4 px-4 sm:pb-6 sm:px-6">
                    <div className="flex flex-col min-w-0">
                        <span className="text-xl sm:text-2xl font-bold text-destructive tracking-tighter truncate">{formatCurrency(collectionStats.remaining)}</span>
                        <p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase mt-1 truncate leading-tight">Pending Ledger Balance</p>
                    </div>
                    <div className="p-2 sm:p-3 rounded-xl bg-destructive/5 text-destructive shadow-inner group-hover:scale-110 transition-transform shrink-0"><ArrowDownRight className="h-5 w-5 sm:h-6 sm:w-6" /></div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-card text-left overflow-hidden group ring-1 ring-primary/5 min-h-[120px]">
                <CardHeader className="pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
                    <CardTitle className="text-[11px] font-black uppercase tracking-tight text-muted-foreground flex items-center justify-between gap-2">
                        <span className="leading-tight">Portfolio Collection Efficiency</span>
                        <Target className="h-3.5 w-3.5 text-primary opacity-40 shrink-0" />
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 space-y-4">
                    <div className="flex items-end justify-between min-w-0">
                        <span className="text-xl sm:text-2xl font-black text-primary tracking-tighter shrink-0">{collectionStats.rate.toFixed(1)}%</span>
                        <Badge variant="outline" className="h-5 px-2 text-[7px] sm:text-[8px] font-black uppercase border-primary/20 bg-primary/5 text-primary truncate ml-2">YTD Metric</Badge>
                    </div>
                    <Progress value={collectionStats.rate} className="h-2.5 bg-muted shadow-inner rounded-full overflow-hidden" />
                </CardContent>
            </Card>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden text-left bg-card">
            <CardHeader className="bg-primary/5 border-b border-primary/10 px-8 py-8 flex flex-row items-center justify-between">
                <div className="text-left space-y-1">
                    <CardTitle className="text-xl font-headline flex items-center gap-3">
                        Monthly Rent Ledger: {selectedYear}/{ (selectedYear + 1).toString().slice(-2) }
                    </CardTitle>
                    <CardDescription className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {selectedProperty.address.street}
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="hidden sm:flex h-8 px-4 rounded-xl border-2 font-bold uppercase text-[9px] tracking-widest bg-background shadow-sm">
                        Registry Active
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className='p-0'>
                {isLoadingPayments ? (
                    <div className="p-32 flex flex-col items-center gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Chronological Trail...</p></div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="pl-10 py-6 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Accounting Period</TableHead>
                                    <TableHead className="font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground text-center">Rent Amount</TableHead>
                                    <TableHead className="font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Audit Status</TableHead>
                                    <TableHead className="pr-10 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground text-right">Management Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statement.map((row) => (
                                    <TableRow key={`${selectedProperty.id}-${row.month}-${row.year}`} className="hover:bg-primary/[0.02] transition-all group border-b border-muted/50">
                                        <TableCell className="pl-10 py-8 text-left">
                                            <div className="flex flex-col gap-0.5 text-left">
                                                <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">{row.month}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {row.year}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-center">
                                                <div className="relative w-full max-w-[350px] group/input">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold text-base opacity-100 transition-opacity">£</span>
                                                    <Input 
                                                        type="number" 
                                                        key={`rent-input-${selectedProperty.id}-${row.month}-${row.year}-${row.rent}`}
                                                        defaultValue={row.rent || 0} 
                                                        className="h-12 pl-10 pr-4 font-mono text-lg font-bold bg-primary/5 border-2 border-transparent hover:border-primary/20 focus:border-primary rounded-xl transition-all shadow-none text-center w-full"
                                                        onBlur={(e) => handleRentAmountChange(row.month, row.year, Number(e.target.value))}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge 
                                                variant={row.status === 'Paid' ? 'default' : row.status === 'Unpaid' ? 'destructive' : 'secondary'}
                                                className={cn(
                                                    "text-[9px] uppercase font-bold px-4 h-7 gap-2 shadow-sm rounded-lg",
                                                    row.status === 'Paid' && "bg-green-100 text-green-800 border-green-200"
                                                )}
                                            >
                                                {row.status === 'Paid' ? <CheckCircle2 className="h-3.5 w-3.5" /> : row.status === 'Pending' ? <Clock className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                                                {row.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="pr-10 text-right">
                                            <Select value={row.status} onValueChange={(v) => handleStatusChange(row.month, row.year, v as PaymentStatus)}>
                                                <SelectTrigger className={cn(
                                                    "w-[180px] h-11 text-xs font-bold ml-auto shadow-md rounded-xl border-2 transition-all",
                                                    row.status === 'Paid' ? "border-green-200 bg-green-50/30" : "bg-background"
                                                )}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent align="end" className="rounded-xl p-1 shadow-2xl">
                                                    <SelectItem value="Paid" className="text-green-600 font-bold rounded-lg focus:bg-green-50 focus:text-green-700 py-2.5">Mark as Paid</SelectItem>
                                                    <SelectItem value="Partially Paid" className="rounded-lg py-2.5">Partially Paid</SelectItem>
                                                    <SelectItem value="Unpaid" className="text-destructive font-bold rounded-lg focus:bg-destructive/5 focus:text-destructive py-2.5">Unpaid / Overdue</SelectItem>
                                                    <SelectItem value="Pending" className="rounded-lg py-2.5">Payment Pending</SelectItem>
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
            <CardFooter className="bg-primary/5 border-t py-10 px-10 flex flex-col sm:flex-row justify-between items-center gap-8">
                <div className="flex gap-12 w-full sm:w-auto">
                    <div className="flex flex-col gap-1 text-left">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em]">Total Accrued</span>
                        <span className="text-2xl font-bold text-foreground tabular-nums tracking-tighter">{formatCurrency(collectionStats.totalExpected)}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em]">Total Outstanding</span>
                        <span className="text-2xl font-bold text-destructive tabular-nums tracking-tighter">{formatCurrency(collectionStats.remaining)}</span>
                    </div>
                </div>
                <div className="text-center sm:text-right space-y-3 w-full sm:w-auto border-t sm:border-t-0 pt-6 sm:pt-0">
                    <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-primary tracking-[0.3em] block">Verified Fiscal Position</span>
                        <p className="text-xs text-muted-foreground font-medium">Registry synchronization active for {selectedYear}</p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground font-bold tracking-tight h-10 px-6 rounded-xl shadow-lg hover:bg-primary/90 transition-all text-sm">
                        Portfolio Collection: {collectionStats.rate.toFixed(0)}%
                    </Badge>
                </div>
            </CardFooter>
        </Card>
    </div>
  );
}

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

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid), where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']), limit(500));
  }, [firestore, user]);
  const { data: activeProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedPropertyId || selectedPropertyId === 'all') return null;
    return query(
      collection(firestore, 'tenants'), 
      where('landlordId', '==', user.uid),
      where('propertyId', '==', selectedPropertyId), 
      where('status', '==', 'Active'), 
      limit(1)
    );
  }, [user, firestore, selectedPropertyId]);
  const { data: propertyTenants } = useCollection<Tenant>(tenantsQuery);
  const activeTenant = propertyTenants?.[0];

  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'expenses'), where('landlordId', '==', user.uid), limit(1000));
  }, [firestore, user]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  const rentQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedTaxYearStart) return null;
    return query(
        collection(firestore, 'rentPayments'), 
        where('landlordId', '==', user.uid),
        where('year', 'in', [selectedTaxYearStart, selectedTaxYearStart + 1])
    );
  }, [user, firestore, selectedTaxYearStart]);
  const { data: allRentPayments, isLoading: isLoadingRent } = useCollection<RentPayment>(rentQuery);

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
    if (!selectedTaxYearStart || !activeProperties) return 0;
    
    const paymentsLookup: Record<string, number> = {};
    rentPayments.forEach(p => {
        paymentsLookup[`${p.propertyId}-${p.month}-${p.year}`] = Number(p.expectedAmount);
    });

    let total = 0;
    const targetProps = selectedPropertyId === 'all' ? activeProperties : activeProperties.filter(p => p.id === selectedPropertyId);

    targetProps.forEach(prop => {
        TAX_MONTHS.forEach(month => {
            const monthIdx = TAX_MONTHS.indexOf(month);
            const calendarYear = monthIdx >= 9 ? selectedTaxYearStart + 1 : selectedTaxYearStart;
            const key = `${prop.id}-${month}-${calendarYear}`;
            
            if (paymentsLookup[key] !== undefined) {
                total += paymentsLookup[key];
            } else {
                total += Number(prop.tenancy?.monthlyRent || 0);
            }
        });
    });

    return total;
  }, [activeProperties, selectedPropertyId, rentPayments, selectedTaxYearStart]);

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
    const repairMaintenance = repairCosts.reduce((a, b) => a + (Number(a.expectedCost || a.estimatedCost || 0)), 0);
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
    <div className="flex flex-col gap-6 max-w-6xl mx-auto text-left animate-in fade-in duration-500">
        <div className="flex flex-col gap-4 max-w-md bg-card p-6 rounded-2xl border shadow-lg ring-1 ring-primary/5">
            <div className="grid w-full gap-1.5 text-left">
                <Label htmlFor="financial-scope-selector" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Registry View</Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="financial-scope-selector" className="h-12 bg-muted/5 rounded-xl border-2">
                        <SelectValue placeholder={isLoadingProperties ? "Syncing..." : "All Properties"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        <SelectItem value="all">Entire Portfolio (Consolidated)</SelectItem>
                        {activeProperties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
                            {formatAddress(prop.address)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid w-full gap-1.5 text-left">
                <Label htmlFor="reporting-year-selector" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">UK Tax Year Cycle</Label>
                <Select onValueChange={(value) => setSelectedTaxYearStart(Number(value))} value={selectedTaxYearStart ? String(selectedTaxYearStart) : ''}>
                    <SelectTrigger id="reporting-year-selector" className="h-12 bg-muted/5 rounded-xl border-2">
                        <SelectValue placeholder="Tax Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {Array.from({ length: 18 }, (_, i) => (new Date().getFullYear() + 12) - i).map(year => (
                            <SelectItem key={year} value={String(year)}>{year} / {(year + 1).toString().slice(-2)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all">
                <div className="h-1 bg-primary w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4"><CardTitle className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Gross Expected</CardTitle></CardHeader>
                <CardContent className='px-4 pb-6'><div className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(totalExpectedRent)}</div></CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all">
                <div className="h-1 bg-green-500 w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4"><CardTitle className="text-sm font-bold uppercase tracking-tight text-green-600">Verified Income</CardTitle></CardHeader>
                <CardContent className='px-4 pb-6'><div className="text-2xl font-bold tracking-tight text-foreground">{isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(totalPaidRent)}</div></CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all">
                <div className="h-1 bg-destructive w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4"><CardTitle className="text-sm font-bold uppercase tracking-tight text-destructive">Total Expenses</CardTitle></CardHeader>
                <CardContent className='px-4 pb-6'><div className="text-2xl font-bold tracking-tight text-foreground">{isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(totalExpenses)}</div></CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all">
                <div className="h-1 bg-amber-500 w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4"><CardTitle className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Taxable Position</CardTitle></CardHeader>
                <CardContent className='px-4 pb-6'><div className={"text-2xl font-bold tracking-tight " + (netIncome < 0 ? "text-destructive" : "text-primary")}>{isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatCurrency(netIncome)}</div></CardContent>
            </Card>
        </div>

        <Tabs defaultValue="expenses" className="pt-4">
            <TabsList className="bg-muted/50 p-1 h-auto rounded-[1rem] w-full sm:w-auto overflow-x-auto justify-start sm:justify-center">
                <TabsTrigger value="expenses" className="font-bold px-8 py-2.5 rounded-lg text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Expense Tracker</TabsTrigger>
                <TabsTrigger value="summary" className="font-bold px-8 py-2.5 rounded-lg text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">HMRC Audit</TabsTrigger>
                <TabsTrigger value="statement" className="font-bold px-8 py-2.5 rounded-lg text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Rent Ledger</TabsTrigger>
            </TabsList>
            <TabsContent value="expenses" className="animate-in fade-in slide-in-from-top-2 duration-500">
                <ExpenseTracker properties={activeProperties || []} selectedPropertyId={selectedPropertyId} />
            </TabsContent>
            <TabsContent value="summary" className="animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="flex justify-end gap-2 mb-4 pt-4">
                  <Button onClick={generateHMRCPDF} size="sm" variant="outline" className="font-bold text-[10px] uppercase tracking-widest h-11 px-8 rounded-xl border-primary/20 bg-background shadow-lg hover:bg-primary/5">
                    <PoundSterling className="mr-2 h-4 w-4 text-primary" /> Export HMRC Tax PDF
                  </Button>
                </div>
                <AnnualSummary selectedYear={selectedTaxYearStart || 0} expenses={expenses} repairCosts={repairCosts} isLoadingExpenses={isLoading} />
            </TabsContent>
            <TabsContent value="statement" className="animate-in fade-in slide-in-from-top-2 duration-500">
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
