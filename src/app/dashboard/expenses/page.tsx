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
  PlusCircle,
  Banknote,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Clock,
  Calendar,
  MapPin,
  Target,
  Inbox,
  ChevronRight,
  ListFilter,
  Wrench,
  FileText,
  Calculator,
  ShieldCheck,
  History,
  Download
} from 'lucide-react';
import { format, isAfter, isBefore, startOfYear, endOfYear, setDate, startOfMonth, getYear, isSameDay } from 'date-fns';
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
import Link from 'next/link';
import { safeToDate } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { generateHMRCPDF } from '@/lib/generate-hmrc-pdf';
import { generateRentPDF } from '@/lib/generate-rent-pdf';

// Standard Calendar Months
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
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
    propertyId: string;
    monthlyRent?: number;
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
            <CardDescription className="text-base font-medium">Record an allowable expense for professional reporting.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 px-8 pb-8">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <FormField control={form.control} name="propertyId" render={({ field }) => (
                <FormItem>
                    <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Target Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-12 bg-muted/5 border-2 rounded-xl"><SelectValue placeholder="Select from portfolio" /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-xl border-2 shadow-2xl">
                      {properties.map(p => (<SelectItem key={p.id} value={p.id} className="rounded-lg py-3 font-medium">{formatAddress(p.address)}</SelectItem>))}
                    </SelectContent>
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
                        <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-12 bg-muted/5 border-2 rounded-xl"><SelectValue placeholder="Select grouping" /></SelectTrigger></FormControl>
                            <SelectContent className="rounded-xl border-2 shadow-2xl">{['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees', 'Other'].map(t => <SelectItem key={t} value={t} className="rounded-lg py-3 font-medium">{t}</SelectItem>)}</SelectContent>
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
                Sync Record to Ledger
            </Button>
            </form>
        </Form>
        </CardContent>
    </Card>
  );
}

function AnnualSummary({ 
    selectedYear, 
    expenses, 
    repairCosts, 
    totalPaidRent, 
    isLoadingExpenses, 
    landlordName, 
    propertyAddress 
}: { 
    selectedYear: number, 
    expenses: Expense[], 
    repairCosts: MaintenanceRepair[], 
    totalPaidRent: number, 
    isLoadingExpenses: boolean,
    landlordName: string,
    propertyAddress: string
}) {
  const [isExporting, setIsExporting] = useState(false);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.expenseType] = (map[e.expenseType] || 0) + (Number(e.amount) || 0); });
    const totalRepairCost = repairCosts.reduce((acc, r) => acc + (Number(r.expectedCost || r.estimatedCost || 0)), 0);
    if (totalRepairCost > 0) map['Repairs and Maintenance'] = (map['Repairs and Maintenance'] || 0) + totalRepairCost;
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [expenses, repairCosts]);

  const totalExpenditure = expensesByCategory.reduce((acc, [, amount]) => acc + amount, 0);
  const netPosition = totalPaidRent - totalExpenditure;

  const handleExportHMRC = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
        await generateHMRCPDF(selectedYear, landlordName, totalPaidRent, expenses, repairCosts, propertyAddress);
        toast({ title: 'HMRC Briefing Generated' });
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <Card className="mt-6 border-none shadow-2xl rounded-[2rem] overflow-hidden text-left bg-card">
        <CardHeader className="bg-primary/5 border-b border-primary/10 px-8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-left">
                <CardTitle className="text-xl font-headline flex items-center gap-3 text-foreground"><Calculator className="h-6 w-6 text-primary" /> Financial Audit Summary: {selectedYear}</CardTitle>
                <CardDescription className="text-base font-medium">Pre-taxation briefing consolidated for professional reporting.</CardDescription>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoadingExpenses ? (<div className="flex h-64 items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>) : (
                <div className="overflow-hidden">
                    <Table className="w-full table-fixed">
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="w-[65%] pl-8 py-5 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Audit Category</TableHead>
                                <TableHead className="w-[35%] text-right pr-8 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Total (£)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-green-50/30 border-b">
                                <TableCell className="font-bold pl-8 py-6 text-base text-green-700 leading-tight">Total Rental Income (Collected)</TableCell>
                                <TableCell className="text-right font-bold pr-8 text-lg tabular-nums text-green-700">{formatCurrency(totalPaidRent)}</TableCell>
                            </TableRow>
                            {expensesByCategory.map(([name, amount]) => (
                                <TableRow key={name} className="hover:bg-primary/[0.02] transition-colors group border-b">
                                    <TableCell className="font-bold pl-8 py-6 text-base group-hover:text-primary transition-colors leading-tight">{name}</TableCell>
                                    <TableCell className="text-right font-bold pr-8 text-lg tabular-nums">{formatCurrency(amount)}</TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="bg-muted/20 border-t-2">
                                <TableCell className="font-bold pl-8 py-6 text-base text-muted-foreground leading-tight">Total Allowable Expenditure</TableCell>
                                <TableCell className="text-right font-bold pr-8 text-lg tabular-nums text-muted-foreground">{formatCurrency(totalExpenditure)}</TableCell>
                            </TableRow>
                            <TableRow className={cn("border-t-2", netPosition >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
                                <TableCell className={cn("font-black pl-8 py-8 text-lg leading-tight", netPosition >= 0 ? "text-primary" : "text-destructive")}>Net Taxable Position</TableCell>
                                <TableCell className={cn("text-right font-black pr-8 text-2xl tabular-nums", netPosition >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(netPosition)}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
        <CardFooter className="p-8 bg-muted/5 border-t flex flex-col gap-8">
            <p className="text-xs text-muted-foreground italic leading-relaxed text-left w-full">
                * This summary is provided for administrative audit purposes. Please consult with a qualified accountant for official HMRC self-assessment submissions.
            </p>
            <div className="w-full flex justify-end">
                <Button onClick={handleExportHMRC} disabled={isExporting || isLoadingExpenses} className="shadow-lg font-bold uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl bg-primary hover:bg-primary/90">
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    HMRC Self Assessment PDF
                </Button>
            </div>
        </CardFooter>
    </Card>
  );
}

function ExpenseHistory({ selectedYear, expenses, repairCosts, properties }: { selectedYear: number, expenses: Expense[], repairCosts: MaintenanceRepair[], properties: Property[] }) {
    const propertyMap = useMemo(() => {
        return properties.reduce((acc, p) => {
            const addr = [p.address.nameOrNumber, p.address.street, p.address.city, p.address.postcode].filter(Boolean).join(', ');
            acc[p.id] = addr;
            return acc;
        }, {} as Record<string, string>);
    }, [properties]);

    const allTransactions = useMemo(() => {
        const exps = expenses.map(e => ({ 
            id: e.id, 
            date: safeToDate(e.date), 
            category: e.expenseType,
            description: e.notes || e.expenseType,
            amount: e.amount, 
            property: propertyMap[e.propertyId] || 'Property Context Missing',
            isRepair: false 
        }));
        const repairs = repairCosts.map(r => ({ 
            id: r.id, 
            date: safeToDate(r.reportedDate), 
            category: 'Repairs and Maintenance',
            description: r.title,
            amount: r.expectedCost || r.estimatedCost || 0, 
            property: propertyMap[r.propertyId] || 'Property Context Missing',
            isRepair: true 
        }));
        return [...exps, ...repairs].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    }, [expenses, repairCosts, propertyMap]);

    return (
        <Card className="mt-6 border-none shadow-2xl rounded-[2rem] overflow-hidden text-left bg-card">
            <CardHeader className="bg-primary/5 border-b border-primary/10 px-8 py-8">
                <CardTitle className="text-xl font-headline flex items-center gap-3 text-foreground"><ListFilter className="h-6 w-6 text-primary" /> Historical Expense Ledger</CardTitle>
                <CardDescription className="text-base font-medium">Detailed list of individual transactions for {selectedYear}.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {!allTransactions.length ? (
                    <div className="py-24 text-center text-muted-foreground italic">No transactions found for this period.</div>
                ) : (
                    <div className="w-full">
                        <div className="hidden md:block">
                            <Table className='w-full table-fixed'>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[12%] pl-6 py-5 font-bold uppercase text-[10px] tracking-widest">Date</TableHead>
                                        <TableHead className="w-[28%] font-bold uppercase text-[10px] tracking-widest">Property</TableHead>
                                        <TableHead className="w-[45%] font-bold uppercase text-[10px] tracking-widest">Expense Detail</TableHead>
                                        <TableHead className="w-[15%] text-right pr-6 font-bold uppercase text-[10px] tracking-widest">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allTransactions.map(t => (
                                        <TableRow key={t.id} className="hover:bg-muted/10 transition-colors">
                                            <TableCell className="pl-6 py-6 text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap align-top">{t.date ? format(t.date, 'dd/MM/yy') : 'N/A'}</TableCell>
                                            <TableCell className="py-6 align-top">
                                                <p className="text-xs font-bold text-foreground leading-relaxed break-words">
                                                    {t.property}
                                                </p>
                                            </TableCell>
                                            <TableCell className="py-6 align-top">
                                                <div className="flex flex-col gap-2 text-left">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant={t.isRepair ? "destructive" : "secondary"} className="h-auto py-1 text-[9px] uppercase font-black px-2.5 rounded-lg shadow-sm border-2 flex items-center whitespace-normal text-center min-w-[120px]">
                                                            {t.isRepair ? <Wrench className="h-3 w-3 mr-1.5 shrink-0" /> : <FileText className="h-3 w-3 mr-1.5 shrink-0" />}
                                                            <span className="leading-tight flex-1">{t.category}</span>
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm font-bold text-foreground leading-relaxed break-words">{t.description}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6 font-black text-foreground tabular-nums text-base whitespace-nowrap align-top">{formatCurrency(t.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="grid gap-4 md:hidden p-4 bg-muted/5">
                            {allTransactions.map(t => (
                                <Card key={t.id} className="shadow-sm border-none overflow-hidden relative text-left">
                                    <div className={cn("absolute left-0 top-0 bottom-0 w-1", t.isRepair ? "bg-destructive" : "bg-primary")} />
                                    <CardContent className="p-4 space-y-3 text-left pl-5">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-1 min-w-0">
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t.date ? format(t.date, 'dd MMM yyyy') : 'N/A'}</p>
                                                <div className="flex items-start gap-1 mt-1">
                                                    <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                                    <p className="text-[10px] font-black text-primary uppercase leading-tight break-words">{t.property}</p>
                                                </div>
                                            </div>
                                            <span className="text-base font-black tabular-nums shrink-0">{formatCurrency(t.amount)}</span>
                                        </div>
                                        <div className="space-y-2">
                                            <Badge variant={t.isRepair ? "destructive" : "secondary"} className="h-auto py-1 text-[8px] uppercase font-bold px-2 rounded-md border shadow-none inline-flex items-center whitespace-normal">
                                                {t.isRepair ? <Wrench className="h-2.5 w-2.5 mr-1" /> : <FileText className="h-2.5 w-2.5 mr-1" />}
                                                {t.category}
                                            </Badge>
                                            <p className="text-sm font-medium text-foreground leading-snug break-words">"{t.description}"</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function RentStatement({ selectedProperty, activeTenant, selectedYear, rentPayments, isLoadingPayments }: { selectedProperty: Property | undefined, activeTenant: Tenant | undefined, selectedYear: number, rentPayments: RentPayment[] | null, isLoadingPayments: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isExporting, setIsExporting] = useState(false);
  
  const statement = useMemo(() => {
    const defaultRent = activeTenant?.monthlyRent || selectedProperty?.tenancy?.monthlyRent || 0;
    const paymentsMap = rentPayments?.reduce((acc, p) => { acc[p.month] = p; return acc; }, {} as Record<string, RentPayment>);
    
    return MONTHS.map(month => {
        return { 
            month, 
            year: selectedYear,
            rent: paymentsMap?.[month]?.expectedAmount ?? defaultRent, 
            amountPaid: paymentsMap?.[month]?.amountPaid ?? 0,
            status: paymentsMap?.[month]?.status || 'Pending' 
        };
    });
  }, [selectedProperty, activeTenant, rentPayments, selectedYear]);

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

  const handleExportStatement = async () => {
    if (!selectedProperty || isExporting) return;
    setIsExporting(true);
    try {
        const addr = [selectedProperty.address.nameOrNumber, selectedProperty.address.street, selectedProperty.address.city, selectedProperty.address.postcode].filter(Boolean).join(', ');
        await generateRentPDF(selectedYear, addr, activeTenant?.name || 'Assigned Resident', statement, collectionStats);
        toast({ title: 'Rental Statement Generated' });
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Export Failed' });
    } finally {
        setIsExporting(false);
    }
  };

  if (!selectedProperty) return (
    <Card className="mt-6 border-2 border-dashed bg-muted/5 h-[450px] flex items-center justify-center rounded-[2rem]">
        <CardContent className='text-center space-y-6 max-w-xs'>
            <div className="bg-background p-8 rounded-full w-fit mx-auto shadow-2xl border-2 border-primary/10">
                <Banknote className="h-12 w-12 text-primary/30" />
            </div>
            <div className="space-y-2">
                <p className="text-foreground font-bold text-xl font-headline">Portfolio Context Required</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Please select a specific property from the registry view to access the interactive rent ledger.</p>
            </div>
        </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700 text-left">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Card className="border-none shadow-xl bg-card text-left overflow-hidden ring-1 ring-primary/5 min-h-[140px] h-auto flex flex-col justify-between">
                <CardHeader className="pb-2 px-5 pt-5 shrink-0">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2 leading-tight">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" />
                        <span>Verified Revenue Collected</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center pb-5 px-5">
                    <span className="text-lg font-black text-green-600 tracking-tight leading-none mb-1 tabular-nums">{formatCurrency(collectionStats.totalCollected)}</span>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Confirmed Registry Income</p>
                </CardContent>
            </Card>
            
            <Card className="border-none shadow-xl bg-card text-left overflow-hidden ring-1 ring-destructive/5 min-h-[140px] h-auto flex flex-col justify-between">
                <CardHeader className="pb-2 px-5 pt-5 shrink-0">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2 leading-tight">
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                        <span>Total Outstanding Arrears</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center pb-5 px-5">
                    <span className="text-lg font-black text-destructive tracking-tight leading-none mb-1 tabular-nums">{formatCurrency(collectionStats.remaining)}</span>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Pending Ledger Balance</p>
                </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-card text-left overflow-hidden ring-1 ring-primary/5 min-h-[140px] h-auto flex flex-col justify-between">
                <CardHeader className="pb-2 px-5 pt-5 shrink-0">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground flex items-center gap-2 leading-tight">
                        <Target className="h-3.5 w-3.5 text-primary" />
                        <span>Collection Efficiency</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center px-5 pb-5 space-y-3">
                    <span className="text-lg font-black text-primary tracking-tight leading-none tabular-nums">{collectionStats.rate.toFixed(1)}%</span>
                    <Progress value={collectionStats.rate} className="h-2 bg-muted shadow-inner" />
                </CardContent>
            </Card>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden text-left bg-card">
            <CardHeader className="bg-primary/5 border-b border-primary/10 px-8 py-8 flex flex-row items-center justify-between">
                <div className="text-left space-y-1">
                    <CardTitle className="text-xl font-headline flex items-center gap-3">
                        Monthly Rent Ledger: {selectedYear}
                    </CardTitle>
                    <CardDescription className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {selectedProperty.address.street}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className='p-0'>
                {isLoadingPayments ? (
                    <div className="p-32 flex flex-col items-center gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Ledger...</p></div>
                ) : (
                    <>
                        <div className="hidden md:block">
                            <Table className="w-full table-fixed">
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[25%] pl-6 py-6 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Period</TableHead>
                                        <TableHead className="w-[20%] font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground text-left">Rent Amount (£)</TableHead>
                                        <TableHead className="w-[25%] font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground">Status</TableHead>
                                        <TableHead className="w-[30%] pr-6 font-bold uppercase text-[10px] tracking-[0.2em] text-muted-foreground text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {statement.map((row) => (
                                        <TableRow key={`${selectedProperty.id}-${row.month}-${row.year}`} className="hover:bg-primary/[0.02] transition-all group border-b border-muted/50">
                                            <TableCell className="pl-6 py-8 text-left">
                                                <div className="flex flex-col gap-0.5 text-left">
                                                    <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">{row.month}</span>
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {row.year}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-start items-center h-12">
                                                    <span className="text-lg font-black text-foreground tabular-nums tracking-tighter">
                                                        {formatCurrency(Number(row.rent))}
                                                    </span>
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
                                            <TableCell className="pr-6 text-right">
                                                <Select value={row.status} onValueChange={(v) => handleStatusChange(row.month, row.year, v as PaymentStatus)}>
                                                    <SelectTrigger className={cn(
                                                        "w-full h-11 text-xs font-bold ml-auto shadow-md rounded-xl border-2 transition-all",
                                                        row.status === 'Paid' ? "border-green-200 bg-green-50/30" : "bg-background"
                                                    )}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent align="end" className="rounded-xl p-1 shadow-2xl min-w-[220px] border-2">
                                                        <SelectItem value="Paid" className="text-green-600 font-bold rounded-lg focus:bg-green-50 focus:text-green-700 py-3.5 cursor-pointer">Mark as Paid</SelectItem>
                                                        <SelectItem value="Partially Paid" className="rounded-lg py-3.5 cursor-pointer font-bold">Partially Paid</SelectItem>
                                                        <SelectItem value="Unpaid" className="text-destructive font-bold rounded-lg focus:bg-destructive/5 focus:text-destructive py-3.5 cursor-pointer">Unpaid / Overdue</SelectItem>
                                                        <SelectItem value="Pending" className="rounded-lg py-3.5 cursor-pointer font-bold">Payment Pending</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="md:hidden grid gap-4 p-4 bg-muted/5">
                            {statement.map((row) => (
                                <Card key={`${selectedProperty.id}-${row.month}-${row.year}`} className="shadow-sm border-none overflow-hidden relative text-left">
                                    <div className={cn(
                                        "absolute left-0 top-0 bottom-0 w-1",
                                        row.status === 'Paid' ? "bg-green-500" : row.status === 'Unpaid' ? "bg-destructive" : "bg-primary"
                                    )} />
                                    <CardContent className="p-4 space-y-4 pl-5">
                                        <div className="flex justify-between items-start">
                                            <div className="text-left">
                                                <p className="text-base font-bold text-foreground">{row.month}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{row.year}</p>
                                            </div>
                                            <span className="text-base font-black tabular-nums">{formatCurrency(Number(row.rent))}</span>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <Badge 
                                                variant={row.status === 'Paid' ? 'default' : row.status === 'Unpaid' ? 'destructive' : 'secondary'}
                                                className={cn(
                                                    "w-fit text-[8px] uppercase font-bold px-3 h-6 gap-1.5 shadow-sm rounded-md",
                                                    row.status === 'Paid' && "bg-green-100 text-green-800 border-green-200"
                                                )}
                                            >
                                                {row.status === 'Paid' ? <CheckCircle2 className="h-3 w-3" /> : row.status === 'Pending' ? <Clock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                {row.status}
                                            </Badge>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase font-bold text-muted-foreground">Action</Label>
                                                <Select value={row.status} onValueChange={(v) => handleStatusChange(row.month, row.year, v as PaymentStatus)}>
                                                    <SelectTrigger className="w-full h-11 text-xs font-bold bg-background shadow-none border-2">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl border-2 shadow-2xl min-w-[220px]">
                                                        <SelectItem value="Paid" className="py-3.5 font-bold text-green-600">Mark as Paid</SelectItem>
                                                        <SelectItem value="Partially Paid" className="py-3.5 font-bold">Partially Paid</SelectItem>
                                                        <SelectItem value="Unpaid" className="py-3.5 font-bold text-destructive">Unpaid / Overdue</SelectItem>
                                                        <SelectItem value="Pending" className="py-3.5 font-bold">Payment Pending</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
            <CardFooter className="bg-muted/5 border-t py-6 px-10 flex justify-end">
                <Button onClick={handleExportStatement} disabled={isExporting || isLoadingPayments} className="font-bold uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-lg gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                    {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download Rental Statement
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}

export default function FinancialsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('expenses');

  useEffect(() => {
    setSelectedYear(new Date().getFullYear());
  }, []);

  // Dynamic 100-year reporting range
  const yearsRange = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 101 }, (_, i) => (current + 50) - i);
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
    if (!user || !firestore || !selectedYear) return null;
    return query(
        collection(firestore, 'rentPayments'), 
        where('landlordId', '==', user.uid),
        where('year', '==', selectedYear)
    );
  }, [user, firestore, selectedYear]);
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

  const yearBounds = useMemo(() => {
    if (!selectedYear) return null;
    return {
        start: startOfYear(new Date(selectedYear, 0, 1)),
        end: endOfYear(new Date(selectedYear, 0, 1))
    };
  }, [selectedYear]);

  const expenses = useMemo(() => {
    if (!allExpenses || !yearBounds) return [];
    return allExpenses.filter(exp => {
        const d = safeToDate(exp.date);
        const matchesYear = d && isAfter(d, yearBounds.start) && isBefore(d, yearBounds.end);
        const matchesProperty = selectedPropertyId === 'all' || exp.propertyId === selectedPropertyId;
        return matchesYear && matchesProperty;
    });
  }, [allExpenses, selectedPropertyId, yearBounds]);

  const repairCosts = useMemo(() => {
    if (!allRepairs || !yearBounds) return [];
    return allRepairs.filter(r => {
        const d = safeToDate(r.reportedDate);
        const matchesYear = d && isAfter(d, yearBounds.start) && isBefore(d, yearBounds.end);
        const matchesProperty = selectedPropertyId === 'all' || r.propertyId === selectedPropertyId;
        const hasCost = Number(r.expectedCost || r.estimatedCost || 0) > 0;
        return matchesYear && matchesProperty && hasCost;
    });
  }, [allRepairs, selectedPropertyId, yearBounds]);

  const rentPayments = useMemo(() => {
    if (!allRentPayments || !selectedYear) return [];
    return allRentPayments.filter(p => {
        const matchesProperty = selectedPropertyId === 'all' || p.propertyId === selectedPropertyId;
        return matchesProperty && p.year === selectedYear;
    });
  }, [allRentPayments, selectedPropertyId, selectedYear]);

  const totalExpectedRent = useMemo(() => {
    if (!selectedYear || !activeProperties) return 0;
    const paymentsLookup: Record<string, number> = {};
    rentPayments.forEach(p => { paymentsLookup[`${p.propertyId}-${p.month}-${p.year}`] = Number(p.expectedAmount); });
    let total = 0;
    const targetProps = selectedPropertyId === 'all' ? activeProperties : activeProperties.filter(p => p.id === selectedPropertyId);
    targetProps.forEach(prop => {
        MONTHS.forEach(month => {
            const key = `${prop.id}-${month}-${selectedYear}`;
            total += paymentsLookup[key] !== undefined ? paymentsLookup[key] : Number(prop.tenancy?.monthlyRent || 0);
        });
    });
    return total;
  }, [activeProperties, selectedPropertyId, rentPayments, selectedYear]);

  const totalPaidRent = useMemo(() => rentPayments.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0), [rentPayments]);
  const totalExpenses = useMemo(() => {
      const baseTotal = expenses.reduce((acc, expense) => acc + (Number(expense.amount) || 0), 0);
      const repairTotal = repairCosts.reduce((acc, r) => acc + (Number(r.expectedCost || r.estimatedCost || 0)), 0);
      return baseTotal + repairTotal;
  }, [expenses, repairCosts]);
  const netIncome = totalPaidRent - totalExpenses;
  const isLoading = isLoadingProperties || isLoadingExpenses || isLoadingRent || isLoadingRepairs || !selectedYear;

  function formatAddress(address: Property['address']) {
    if (!address) return 'N/A';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto text-left animate-in fade-in duration-500">
        <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                    <PoundSterling className="h-6 w-6" />
                </div>
                <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Financial Ledger</h1>
            </div>
            <p className="text-muted-foreground font-medium text-lg ml-1">Consolidated revenue, expenditure, and tax position for your portfolio.</p>
        </div>

        <div className="flex flex-col gap-4 max-w-md bg-card p-6 rounded-2xl border shadow-lg ring-1 ring-primary/5">
            <div className="grid w-full gap-1.5 text-left">
                <Label htmlFor="financial-scope-selector" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Registry View</Label>
                <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                    <SelectTrigger id="financial-scope-selector" className="h-12 bg-muted/5 rounded-xl border-2">
                        <SelectValue placeholder={isLoadingProperties ? "Syncing..." : "All Properties"} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2 shadow-2xl">
                        <SelectItem value="all" className="py-3 font-bold">Entire Portfolio (Consolidated)</SelectItem>
                        {activeProperties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id} className="py-3 font-medium">{formatAddress(prop.address)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid w-full gap-1.5 text-left">
                <Label htmlFor="reporting-year-selector" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1">Reporting Year</Label>
                <Select onValueChange={(value) => setSelectedYear(Number(value))} value={selectedYear ? String(selectedYear) : ''}>
                    <SelectTrigger id="reporting-year-selector" className="h-12 bg-muted/5 rounded-xl border-2">
                        <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2 shadow-2xl max-h-80">
                        {yearsRange.map(year => (
                            <SelectItem key={year} value={String(year)} className="py-3 font-bold">{year}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card 
                className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all min-h-[140px] h-auto flex flex-col cursor-pointer"
                onClick={() => setActiveTab('expenses')}
            >
                <div className="h-1 bg-primary w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground leading-tight">Gross Expected</CardTitle>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent className='px-4 pb-6 flex-1 flex flex-col justify-center'><div className="text-lg font-black tracking-tighter text-foreground tabular-nums">{formatCurrency(totalExpectedRent)}</div></CardContent>
            </Card>
            <Card 
                className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all min-h-[140px] h-auto flex flex-col cursor-pointer"
                onClick={() => setActiveTab('statement')}
            >
                <div className="h-1 bg-green-500 w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-tight text-green-600 leading-tight">Verified Income</CardTitle>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent className='px-4 pb-6 flex-1 flex flex-col justify-center'><div className="text-lg font-black tracking-tighter text-foreground tabular-nums">{isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : formatCurrency(totalPaidRent)}</div></CardContent>
            </Card>
            <Card 
                className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all min-h-[140px] h-auto flex flex-col cursor-pointer"
                onClick={() => setActiveTab('history')}
            >
                <div className="h-1 bg-destructive w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-tight text-destructive leading-tight">Total Expenses</CardTitle>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent className='px-4 pb-6 flex-1 flex flex-col justify-center'><div className="text-lg font-black tracking-tighter text-foreground tabular-nums">{isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : formatCurrency(totalExpenses)}</div></CardContent>
            </Card>
            <Card 
                className="border-none shadow-md overflow-hidden text-left bg-card group hover:shadow-xl transition-all min-h-[140px] h-auto flex flex-col cursor-pointer"
                onClick={() => setActiveTab('summary')}
            >
                <div className="h-1 bg-amber-500 w-full opacity-20 group-hover:opacity-100 transition-opacity" />
                <CardHeader className="pb-2 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-[11px] font-bold uppercase tracking-tight text-muted-foreground leading-tight">Taxable Position</CardTitle>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardHeader>
                <CardContent className='px-4 pb-6 flex-1 flex flex-col justify-center'><div className={"text-lg font-black tracking-tighter tabular-nums " + (netIncome < 0 ? "text-destructive" : "text-primary")}>{isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : formatCurrency(netIncome)}</div></CardContent>
            </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-4">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-muted/50 p-1 h-auto rounded-[1.25rem] w-full gap-1 border shadow-inner">
                <TabsTrigger value="expenses" className="font-bold px-2 py-2.5 rounded-lg text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all whitespace-normal text-center h-full">Expense Tracker</TabsTrigger>
                <TabsTrigger value="history" className="font-bold px-2 py-2.5 rounded-lg text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all whitespace-normal text-center h-full">Expense History</TabsTrigger>
                <TabsTrigger value="statement" className="font-bold px-2 py-2.5 rounded-lg text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all whitespace-normal text-center h-full">Rent Ledger</TabsTrigger>
                <TabsTrigger value="summary" className="font-bold px-2 py-2.5 rounded-lg text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all whitespace-normal text-center h-full">Audit Summary</TabsTrigger>
            </TabsList>
            <TabsContent value="expenses" className="animate-in fade-in slide-in-from-top-2 duration-500"><ExpenseTracker properties={activeProperties || []} selectedPropertyId={selectedPropertyId} /></TabsContent>
            <TabsContent value="history" className="animate-in fade-in slide-in-from-top-2 duration-500"><ExpenseHistory selectedYear={selectedYear || 0} expenses={expenses} repairCosts={repairCosts} properties={activeProperties || []} /></TabsContent>
            <TabsContent value="statement" className="animate-in fade-in slide-in-from-top-2 duration-500"><RentStatement selectedProperty={selectedProperty} activeTenant={activeTenant} selectedYear={selectedYear || 0} rentPayments={rentPayments} isLoadingPayments={isLoading} /></TabsContent>
            <TabsContent value="summary" className="animate-in fade-in slide-in-from-top-2 duration-500">
                <AnnualSummary 
                    selectedYear={selectedYear || 0} 
                    expenses={expenses} 
                    repairCosts={repairCosts} 
                    totalPaidRent={totalPaidRent} 
                    isLoadingExpenses={isLoading}
                    landlordName={user?.displayName || 'Management'}
                    propertyAddress={selectedPropertyId === 'all' ? 'Entire Portfolio' : formatAddress(selectedProperty?.address!)}
                />
            </TabsContent>
        </Tabs>
    </div>
  );
}
