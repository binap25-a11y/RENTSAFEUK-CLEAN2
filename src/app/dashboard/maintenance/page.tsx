'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  Loader2, 
  Wrench, 
  AlertCircle, 
  Calendar, 
  PlusCircle, 
  Search, 
  ChevronsUpDown,
  History,
  Banknote
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState, useMemo, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, addDoc, limit, where } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other'];
const PRIORITIES = ['Emergency', 'Urgent', 'Routine', 'Low'];
const REPORTERS = ['Landlord', 'Tenant', 'Agent', 'Other'];

const maintenanceSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Please select a property.'),
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  otherCategoryDetails: z.string().optional(),
  priority: z.string({ required_error: 'Please select a priority.' }),
  reportedBy: z.string().default('Landlord'),
  reportedDate: z.coerce.date(),
  contractorName: z.string().optional(),
  contractorPhone: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  expectedCost: z.coerce.number().min(0, "Cost cannot be negative").default(0),
  notes: z.string().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
  landlordId: string;
  status: string;
}

interface Contractor {
    id: string;
    name: string;
    phone: string;
    trade: string;
}

function MaintenanceFormContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPropSelectorOpen, setIsPropSelectorOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  const propertyIdFromUrl = searchParams.get('propertyId');
  const titleFromUrl = searchParams.get('title');
  const descriptionFromUrl = searchParams.get('description');

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      propertyId: propertyIdFromUrl || '',
      title: titleFromUrl || '',
      description: descriptionFromUrl || '',
      category: typeof window !== 'undefined' ? (localStorage.getItem('last_repair_cat') || '') : '',
      priority: typeof window !== 'undefined' ? (localStorage.getItem('last_repair_prio') || 'Routine') : 'Routine',
      reportedBy: 'Landlord',
      contractorName: '',
      contractorPhone: '',
      expectedCost: 0,
    },
  });

  const watchCategory = form.watch('category');
  const selectedPropertyId = form.watch('propertyId');
  const watchContractorName = form.watch('contractorName');
  const watchContractorPhone = form.watch('contractorPhone');

  useEffect(() => {
    form.setValue('reportedDate', new Date());
  }, [form]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid), limit(500));
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    const term = propertySearch.toLowerCase();
    return properties.filter(p => [p.address.street, p.address.postcode].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [properties, propertySearch]);

  const selectedProperty = useMemo(() => properties?.find(p => p.id === selectedPropertyId), [properties, selectedPropertyId]);

  const contractorsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'contractors'), where('landlordId', '==', user.uid), limit(500));
  }, [firestore, user]);
  const { data: contractors } = useCollection<Contractor>(contractorsQuery);

  const matchedContractorId = useMemo(() => {
      if (!contractors || !watchContractorName || !watchContractorPhone) return "";
      return contractors.find(c => c.name === watchContractorName && c.phone === watchContractorPhone)?.id || "";
  }, [contractors, watchContractorName, watchContractorPhone]);

  async function handleFormSubmit(data: MaintenanceFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    localStorage.setItem('last_repair_cat', data.category);
    localStorage.setItem('last_repair_prio', data.priority);

    try {
      const logsCollection = collection(firestore, 'repairs');
      const docRef = await addDoc(logsCollection, { ...data, landlordId: user.uid, status: 'Open', createdDate: new Date().toISOString() });
      toast({ title: 'Issue Logged' });
      router.push(`/dashboard/maintenance/${docRef.id}?propertyId=${data.propertyId}`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Save Failed' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const formatAddress = (address: Property['address']) => [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-left">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-headline tracking-tight text-primary flex items-center gap-2">
                <Wrench className="h-8 w-8" /> Maintenance Hub
            </h1>
            <p className="text-muted-foreground font-medium text-lg">Record and track repairs across your portfolio.</p>
        </div>

        <Button asChild variant="outline" className="font-bold shadow-sm h-11 px-6 border-primary/20 hover:bg-primary/5 transition-all">
            <Link href="/dashboard/maintenance/logged"><History className="mr-2 h-4 w-4 text-primary" /> View History</Link>
        </Button>

        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <CardTitle className="text-xl flex items-center gap-2 text-foreground"><AlertCircle className="h-5 w-5 text-primary" />Log New Issue</CardTitle>
            <CardDescription>Comprehensive documentation ensures efficient resolution and audit integrity.</CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-10">
                {/* 1. ISSUE DETAILS */}
                <div className="space-y-6">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary px-1">1. Discovery Details</h3>
                    <FormField control={form.control} name="propertyId" render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel className="font-bold">Target Property</FormLabel>
                        <Popover open={isPropSelectorOpen} onOpenChange={setIsPropSelectorOpen}>
                            <PopoverTrigger asChild>
                                <FormControl><Button variant="outline" className={cn("w-full justify-between h-11 bg-background text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {selectedProperty ? formatAddress(selectedProperty.address) : "Search assets..."}<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button></FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl">
                                <div className="flex items-center border-b px-3 bg-muted/20"><Search className="h-4 w-4 shrink-0 opacity-50 mr-2" /><Input placeholder="Type street..." className="h-11 border-0 focus-visible:ring-0 bg-transparent" value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} /></div>
                                <ScrollArea className="h-72">{filteredProperties.map(p => (<Button key={p.id} variant="ghost" className={cn("w-full justify-start text-xs py-4 h-auto text-left px-4", p.id === field.value && "bg-primary/5 text-primary font-bold")} onClick={() => { form.setValue('propertyId', p.id); setIsPropSelectorOpen(false); }}>{formatAddress(p.address)}</Button>))}</ScrollArea>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel className="font-bold">Issue Title</FormLabel><FormControl><Input placeholder="e.g. Broken Boiler" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel className="font-bold">Detailed Description</FormLabel><FormControl><Textarea placeholder="Specific details for contractor access..." className="min-h-[100px] resize-none rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="expectedCost" render={({ field }) => (
                      <FormItem className="max-w-md"><FormLabel className="font-bold flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" />Expected Cost (£)</FormLabel><FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" className="h-11" {...field} value={field.value === 0 ? '' : field.value} onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))} /></FormControl><FormDescription className="text-[10px]">Tax baseline. Must be 0 or more.</FormDescription><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold">Trade Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Pick type" /></SelectTrigger></FormControl><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="priority" render={({ field }) => (
                        <FormItem><FormLabel className="font-bold">Urgency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Pick priority" /></SelectTrigger></FormControl><SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                      )} />
                    </div>
                </div>

                {/* 2. ASSIGNMENT */}
                <div className="space-y-8 border-t pt-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary px-1">2. Remediation Assignment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 text-left">
                            <Label className="font-bold text-xs">Quick-select Contractor</Label>
                            <Select value={matchedContractorId} onValueChange={(cid) => { const c = contractors?.find(x => x.id === cid); if (c) { form.setValue('contractorName', c.name); form.setValue('contractorPhone', c.phone); const cat = CATEGORIES.find(cat => c.trade.toLowerCase().includes(cat.toLowerCase().substring(0,4))); if (cat) form.setValue('category', cat); } }}>
                                <SelectTrigger className="h-11 bg-muted/20"><SelectValue placeholder="Directory search..." /></SelectTrigger>
                                <SelectContent>{contractors?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.trade})</SelectItem>)}</SelectContent>
                            </Select>
                            <FormField control={form.control} name="contractorName" render={({ field }) => (<FormItem><FormLabel className="font-bold">Assigned To</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="space-y-4">
                            <FormField control={form.control} name="contractorPhone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Contractor Phone</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="scheduledDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Visit Date</FormLabel><FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={e => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                </div>

                {/* 3. AUDIT INFO */}
                <div className="space-y-6 border-t pt-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2"><Calendar className="h-4 w-4" /> 3. Audit Context</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <FormField control={form.control} name="reportedBy" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold">Reported By</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>{REPORTERS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="reportedDate" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold">Date of Report</FormLabel>
                                <FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={e => field.onChange(e.target.value)} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </div>
                
                <Button type="submit" disabled={isSubmitting} className="w-full font-bold shadow-lg h-12 uppercase tracking-widest text-xs">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Log Maintenance Request
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
    </div>
  );
}

export default function MaintenancePage() { return (<Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}><MaintenanceFormContent /></Suspense>); }
