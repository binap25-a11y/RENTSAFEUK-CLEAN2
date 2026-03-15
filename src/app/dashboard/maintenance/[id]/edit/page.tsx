'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, ArrowLeft, Banknote, Calendar, HardHat } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, limit } from 'firebase/firestore';
import { safeToDate, formatDateForInput } from '@/lib/date-utils';

const maintenanceEditSchema = z.object({
  propertyId: z.string().min(1, 'Property selection required'),
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  otherCategoryDetails: z.string().optional(),
  priority: z.string({ required_error: 'Please select a priority.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  reportedBy: z.string().default('Landlord'),
  reportedDate: z.coerce.date(),
  contractorName: z.string().optional(),
  contractorPhone: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  expectedCost: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceEditSchema>;

interface MaintenanceLog {
  propertyId: string;
  title: string;
  description?: string;
  category: string;
  otherCategoryDetails?: string;
  priority: string;
  status: string;
  reportedBy?: string;
  reportedDate: any;
  contractorName?: string;
  contractorPhone?: string;
  scheduledDate?: any;
  expectedCost?: number;
  notes?: string;
}

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
}

interface Contractor {
    id: string;
    name: string;
    phone: string;
    trade: string;
}

const CATEGORIES = ['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other'];
const PRIORITIES = ['Emergency', 'Urgent', 'Routine', 'Low'];
const STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];
const REPORTERS = ['Landlord', 'Tenant', 'Agent', 'Other'];

export default function EditMaintenancePage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { user } = useUser();
    const firestore = useFirestore();

    const logId = params.id as string;
    const propertyIdFromUrl = searchParams.get('propertyId');

    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<MaintenanceFormValues>({
        resolver: zodResolver(maintenanceEditSchema),
        defaultValues: {
            reportedBy: 'Landlord',
            status: 'Open',
            priority: 'Routine',
            expectedCost: 0
        }
    });

    const watchContractorName = form.watch('contractorName');
    const watchContractorPhone = form.watch('contractorPhone');

    const maintenanceLogRef = useMemoFirebase(() => {
        if (!firestore || !logId || !user) return null;
        return doc(firestore, 'repairs', logId);
    }, [firestore, logId, user]);

    const { data: maintenanceLog, isLoading: isLoadingLog } = useDoc<MaintenanceLog>(maintenanceLogRef);

    const propertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid), limit(500));
    }, [firestore, user]);
    const { data: properties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

    const contractorsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'contractors'), where('landlordId', '==', user.uid), limit(500));
    }, [firestore, user]);
    const { data: contractors } = useCollection<Contractor>(contractorsQuery);

    const matchedContractorId = useMemo(() => {
        if (!contractors || !watchContractorName || !watchContractorPhone) return "";
        return contractors.find(c => c.name === watchContractorName && c.phone === watchContractorPhone)?.id || "";
    }, [contractors, watchContractorName, watchContractorPhone]);

    // Standardizes casing for dropdown matching
    const normalizeValue = (val: string, options: string[]) => {
        if (!val) return "";
        const found = options.find(o => o.toLowerCase() === val.toLowerCase());
        return found || val;
    };

    useEffect(() => {
        if (maintenanceLog) {
            form.reset({
                propertyId: maintenanceLog.propertyId || propertyIdFromUrl || '',
                title: maintenanceLog.title || '',
                description: maintenanceLog.description || '',
                category: normalizeValue(maintenanceLog.category, CATEGORIES),
                priority: normalizeValue(maintenanceLog.priority, PRIORITIES),
                status: normalizeValue(maintenanceLog.status, STATUSES),
                reportedBy: normalizeValue(maintenanceLog.reportedBy || 'Landlord', REPORTERS),
                reportedDate: safeToDate(maintenanceLog.reportedDate) || new Date(),
                scheduledDate: safeToDate(maintenanceLog.scheduledDate) || undefined,
                expectedCost: maintenanceLog.expectedCost || 0,
                otherCategoryDetails: maintenanceLog.otherCategoryDetails || '',
                notes: maintenanceLog.notes || '',
                contractorName: maintenanceLog.contractorName || '',
                contractorPhone: maintenanceLog.contractorPhone || '',
            });
        }
    }, [maintenanceLog, form, propertyIdFromUrl]);

    async function handleFormSubmit(data: MaintenanceFormValues) {
        if (!user || !firestore || !maintenanceLogRef) return;
        setIsSaving(true);

        const cleanedData = JSON.parse(JSON.stringify(data));

        try {
            await updateDoc(maintenanceLogRef, cleanedData);
            toast({ title: 'Record Updated', description: 'The maintenance registry has been synchronized.' });
            router.push(`/dashboard/maintenance/${logId}?propertyId=${data.propertyId}`);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        } finally {
            setIsSaving(false);
        }
    }

    const formatAddress = (address: Property['address']) => [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');

    const isLoading = isLoadingLog || isLoadingProps;

    if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (!maintenanceLog) return <div className="text-center py-10">Record not found.</div>;

    // Use a stable data-key to force dropdown synchronization when the record is loaded
    const dataKey = maintenanceLog ? 'registry-loaded' : 'registry-pending';

    return (
        <div className="max-w-2xl mx-auto space-y-6 text-left">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild><Link href={`/dashboard/maintenance/${logId}?propertyId=${maintenanceLog.propertyId}`}><ArrowLeft className="h-4 w-4" /></Link></Button>
                <h1 className="text-2xl font-bold font-headline">Edit Maintenance</h1>
            </div>
            
            <Card className="shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6 text-left">
                    <CardTitle>Update Registry</CardTitle>
                    <CardDescription>Modify the current state and financial impact of this repair.</CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-10">
                            {/* 1. ISSUE DETAILS */}
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary px-1">1. Issue Audit</h3>
                                <FormField control={form.control} name="propertyId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Target Property</FormLabel>
                                        <Select key={`${dataKey}-prop`} onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select property" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {properties?.map(p => (<SelectItem key={p.id} value={p.id}>{formatAddress(p.address)}</SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel className="font-bold">Title</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel className="font-bold">Description</FormLabel><FormControl><Textarea rows={4} className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="expectedCost" render={({ field }) => (
                                    <FormItem className="max-w-md"><FormLabel className="font-bold flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" />Expected Cost (£)</FormLabel>
                                        <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" className="h-11" {...field} value={field.value === 0 ? '' : field.value} onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="category" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">Category</FormLabel>
                                            <Select key={`${dataKey}-cat`} onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                                                <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="priority" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">Priority</FormLabel>
                                            <Select key={`${dataKey}-prio`} onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                                                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel className="font-bold">Repair Status</FormLabel>
                                        <Select key={`${dataKey}-status`} onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {/* 2. ASSIGNMENT */}
                            <div className="space-y-8 border-t pt-8">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary px-1">2. Assignment</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <Label className="font-bold text-xs">Quick-select Contractor</Label>
                                        <Select 
                                            key={`${dataKey}-contractor-match`}
                                            value={matchedContractorId} 
                                            onValueChange={(cid) => { 
                                                const c = contractors?.find(x => x.id === cid); 
                                                if (c) { 
                                                    form.setValue('contractorName', c.name); 
                                                    form.setValue('contractorPhone', c.phone); 
                                                    const cat = CATEGORIES.find(cat => c.trade.toLowerCase().includes(cat.toLowerCase().substring(0,4))); 
                                                    if (cat) form.setValue('category', cat); 
                                                } 
                                            }}
                                        >
                                            <SelectTrigger className="h-11 bg-muted/20"><SelectValue placeholder="Search directory..." /></SelectTrigger>
                                            <SelectContent>{contractors?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.trade})</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormField control={form.control} name="contractorName" render={({ field }) => (<FormItem><FormLabel className="font-bold">Assigned To</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <div className="space-y-4">
                                        <FormField control={form.control} name="contractorPhone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Contractor Phone</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="scheduledDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Scheduled Date</FormLabel><FormControl><Input type="date" className="h-11" value={formatDateForInput(field.value)} onChange={e => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                </div>
                            </div>

                            {/* 3. AUDIT */}
                            <div className="space-y-6 border-t pt-8">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1">3. Audit History</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FormField control={form.control} name="reportedBy" render={({ field }) => (
                                        <FormItem><FormLabel className="font-bold">Reported By</FormLabel>
                                            <Select key={`${dataKey}-reporter`} onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select reporter" /></SelectTrigger></FormControl>
                                                <SelectContent>{REPORTERS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="reportedDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Reported Date</FormLabel><FormControl><Input type="date" className="h-11" value={formatDateForInput(field.value)} onChange={e => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t">
                                <Button type="button" variant="ghost" asChild className="h-11 font-bold uppercase text-xs tracking-widest"><Link href={`/dashboard/maintenance/${logId}?propertyId=${maintenanceLog.propertyId}`}>Cancel</Link></Button>
                                <Button type="submit" disabled={isSaving} className="h-11 px-10 shadow-lg font-bold uppercase text-xs tracking-widest">
                                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Record Changes'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
