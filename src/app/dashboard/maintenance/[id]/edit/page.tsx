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
  FormDescription,
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
import { Loader2, ArrowLeft, Banknote, Calendar, HardHat, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { safeToDate } from '@/lib/date-utils';

const maintenanceEditSchema = z.object({
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
  expectedCost: z.coerce.number().min(0, "Cost cannot be negative").default(0),
  notes: z.string().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceEditSchema>;

interface MaintenanceLog {
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
  estimatedCost?: number;
  notes?: string;
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
    const propertyId = searchParams.get('propertyId');

    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<MaintenanceFormValues>({
        resolver: zodResolver(maintenanceEditSchema),
        defaultValues: {
            title: '',
            category: '',
            priority: 'Routine',
            status: 'Open',
            reportedBy: 'Landlord',
            expectedCost: 0,
        }
    });

    const watchCategory = form.watch('category');
    const watchContractorName = form.watch('contractorName');
    const watchContractorPhone = form.watch('contractorPhone');

    const maintenanceLogRef = useMemoFirebase(() => {
        if (!firestore || !logId || !user) return null;
        return doc(firestore, 'repairs', logId);
    }, [firestore, logId, user]);

    const { data: maintenanceLog, isLoading: isLoadingLog } = useDoc<MaintenanceLog>(maintenanceLogRef);

    const contractorsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'contractors'), where('landlordId', '==', user.uid));
    }, [firestore, user]);
    const { data: contractors } = useCollection<Contractor>(contractorsQuery);

    const matchedContractorId = useMemo(() => {
        if (!contractors || !watchContractorName || !watchContractorPhone) return "";
        return contractors.find(c => c.name === watchContractorName && c.phone === watchContractorPhone)?.id || "";
    }, [contractors, watchContractorName, watchContractorPhone]);

    // PRE-FILL LOGIC: Definitively sync form state with DB record
    useEffect(() => {
        if (maintenanceLog) {
            form.reset({
                title: maintenanceLog.title || '',
                description: maintenanceLog.description || '',
                category: maintenanceLog.category || '',
                priority: maintenanceLog.priority || 'Routine',
                status: maintenanceLog.status || 'Open',
                reportedBy: maintenanceLog.reportedBy || 'Landlord',
                reportedDate: safeToDate(maintenanceLog.reportedDate) || new Date(),
                scheduledDate: safeToDate(maintenanceLog.scheduledDate) || undefined,
                expectedCost: maintenanceLog.expectedCost ?? maintenanceLog.estimatedCost ?? 0,
                otherCategoryDetails: maintenanceLog.otherCategoryDetails ?? '',
                notes: maintenanceLog.notes ?? '',
                contractorName: maintenanceLog.contractorName ?? '',
                contractorPhone: maintenanceLog.contractorPhone ?? '',
            });
        }
    }, [maintenanceLog, form]);

    async function handleFormSubmit(data: MaintenanceFormValues) {
        if (!user || !firestore || !maintenanceLogRef) return;
        setIsSaving(true);

        const cleanedData = JSON.parse(JSON.stringify(data));

        try {
            await updateDoc(maintenanceLogRef, cleanedData);
            toast({ title: 'Maintenance Log Updated' });
            router.push(`/dashboard/maintenance/${logId}?propertyId=${propertyId}`);
        } catch (error) {
            console.error('Failed to update maintenance log', error);
            toast({ variant: 'destructive', title: 'Update Failed' });
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoadingLog) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    
    if (!maintenanceLog) {
        return <div className="text-center py-10">Maintenance log not found.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 text-left">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/dashboard/maintenance/${logId}?propertyId=${propertyId}`}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold font-headline">Edit Maintenance</h1>
                </div>
            </div>
            
            <Card className="shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <CardTitle className="text-xl">Update Issue Details</CardTitle>
                    <CardDescription>Modify the current state and financial impact of this repair.</CardDescription>
                </CardHeader>
                <CardContent className="pt-8">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-10">
                            {/* SECTION 1: ISSUE DETAILS */}
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary px-1">Issue Metadata</h3>
                                <FormField control={form.control} name="title" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Issue Title</FormLabel>
                                        <FormControl><Input className="h-11" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <FormField control={form.control} name="description" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Detailed Description</FormLabel>
                                        <FormControl><Textarea rows={4} className="resize-none" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="expectedCost" render={({ field }) => (
                                    <FormItem className="max-w-md">
                                        <FormLabel className="font-bold flex items-center gap-2">
                                            <Banknote className="h-4 w-4 text-primary" />
                                            Expected Cost (£)
                                        </FormLabel>
                                        <FormControl>
                                        <Input 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="0.00" 
                                            className="h-11 bg-background" 
                                            {...field}
                                            value={field.value === 0 ? '' : field.value}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                field.onChange(val === '' ? 0 : Number(val));
                                            }}
                                        />
                                        </FormControl>
                                        <FormDescription className="text-[10px]">Will be reflected in portfolio financials. Must be 0 or greater.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormField control={form.control} name="category" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold">Category</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Pick category" /></SelectTrigger></FormControl>
                                                <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="priority" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold">Priority</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Pick priority" /></SelectTrigger></FormControl>
                                                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>

                                {watchCategory === 'Other' && (
                                  <FormField control={form.control} name="otherCategoryDetails" render={({ field }) => (
                                      <FormItem className="animate-in fade-in slide-in-from-top-2">
                                        <FormLabel className="font-bold">Other Category Details</FormLabel>
                                        <FormControl><Textarea placeholder="Specify trade required..." className="resize-none bg-muted/50" {...field} value={field.value ?? ''} /></FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                )}

                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Repair Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Update status" /></SelectTrigger></FormControl>
                                            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {/* SECTION 2: ASSIGNMENT */}
                            <div className="space-y-8 border-t pt-8">
                                <div className="space-y-6">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary px-1">Assignment Registry</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="space-y-2 text-left">
                                                <Label className="font-bold text-xs" htmlFor="edit-contractor-quick-select">Quick-select Contractor</Label>
                                                <Select value={matchedContractorId} onValueChange={(contractorId) => {
                                                    const contractor = contractors?.find(c => c.id === contractorId);
                                                    if (contractor) {
                                                        form.setValue('contractorName', contractor.name);
                                                        form.setValue('contractorPhone', contractor.phone);
                                                        // Fuzzy match trade to category
                                                        const matchedCat = CATEGORIES.find(c => contractor.trade.toLowerCase().includes(c.toLowerCase().substring(0, 4)));
                                                        if (matchedCat) form.setValue('category', matchedCat);
                                                    }
                                                }}>
                                                    <SelectTrigger id="edit-contractor-quick-select" className="h-11 bg-muted/20">
                                                        <SelectValue placeholder="Search directory..." />
                                                    </SelectTrigger>
                                                    <SelectContent>{contractors?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.trade})</SelectItem>)}</SelectContent>
                                                </Select>
                                            </div>
                                            <FormField control={form.control} name="contractorName" render={({ field }) => (<FormItem><FormLabel className="font-bold">Assigned To</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                        <div className="space-y-4">
                                            <FormField control={form.control} name="contractorPhone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Contractor Phone</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-bold">Scheduled Visit Date</FormLabel>
                                                    <FormControl>
                                                        <Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: AUDIT INFO */}
                            <div className="space-y-6 border-t pt-8">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2"><Calendar className="h-4 w-4" /> Audit Info</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <FormField control={form.control} name="reportedBy" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold">Reported By</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Reporter type" /></SelectTrigger></FormControl>
                                                <SelectContent>{REPORTERS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="reportedDate" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold">Date of Report</FormLabel>
                                            <FormControl>
                                                <Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t">
                                <Button type="button" variant="ghost" asChild className="h-11 font-bold uppercase text-xs tracking-widest"><Link href={`/dashboard/maintenance/${logId}?propertyId=${propertyId}`}>Cancel</Link></Button>
                                <Button type="submit" disabled={isSaving} className="h-11 px-10 shadow-lg font-bold uppercase text-xs tracking-widest">
                                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing...</> : 'Save Record Changes'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
