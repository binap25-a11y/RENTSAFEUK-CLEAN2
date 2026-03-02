
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';

const maintenanceEditSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  otherCategoryDetails: z.string().optional(),
  priority: z.string({ required_error: 'Please select a priority.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  reportedBy: z.string().optional(),
  reportedDate: z.coerce.date(),
  contractorName: z.string().optional(),
  contractorPhone: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  estimatedCost: z.coerce.number().optional(),
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
  reportedDate: Timestamp | Date;
  contractorName?: string;
  contractorPhone?: string;
  scheduledDate?: Timestamp | Date;
  estimatedCost?: number;
  notes?: string;
}

interface Contractor {
    id: string;
    name: string;
    phone: string;
    trade: string;
}

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
    });

    const watchCategory = form.watch('category');

    const maintenanceLogRef = useMemoFirebase(() => {
        if (!firestore || !propertyId || !logId || !user) return null;
        return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'maintenanceLogs', logId);
    }, [firestore, propertyId, logId, user]);

    const { data: maintenanceLog, isLoading: isLoadingLog } = useDoc<MaintenanceLog>(maintenanceLogRef);

    const contractorsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(collection(firestore, 'userProfiles', user.uid, 'contractors'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data: contractors } = useCollection<Contractor>(contractorsQuery);

    useEffect(() => {
        if (maintenanceLog) {
            form.reset({
                ...maintenanceLog,
                reportedDate: maintenanceLog.reportedDate instanceof Date ? maintenanceLog.reportedDate : new Date(maintenanceLog.reportedDate.seconds * 1000),
                scheduledDate: maintenanceLog.scheduledDate ? (maintenanceLog.scheduledDate instanceof Date ? maintenanceLog.scheduledDate : new Date(maintenanceLog.scheduledDate.seconds * 1000)) : undefined,
                otherCategoryDetails: maintenanceLog.otherCategoryDetails ?? '',
                notes: maintenanceLog.notes ?? '',
            });
        }
    }, [maintenanceLog, form]);

    async function handleFormSubmit(data: MaintenanceFormValues) {
        if (!user || !firestore || !maintenanceLogRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save. Please try again.' });
            return;
        }
        setIsSaving(true);

        try {
            await updateDoc(maintenanceLogRef, { ...data });

            toast({ title: 'Maintenance Log Updated', description: 'The changes have been saved.' });
            router.push(`/dashboard/maintenance/${logId}?propertyId=${propertyId}`);
        } catch (error) {
            console.error('Failed to update maintenance log', error);
             const permissionError = new FirestorePermissionError({ path: maintenanceLogRef.path, operation: 'update', requestResourceData: data });
             errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Update Failed', description: (error as Error).message || 'There was an error updating the log.' });
        } finally {
            setIsSaving(false);
        }
    }


    if (isLoadingLog) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (!maintenanceLog) {
        return <div className="text-center py-10">Maintenance log not found.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild>
                    <Link href={`/dashboard/maintenance/${logId}?propertyId=${propertyId}`}><Loader2 className="h-4 w-4 rotate-180" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold font-headline">Edit maintenance</h1>
                </div>
            </div>
            
            <Card className="shadow-lg border-none">
                <CardHeader>
                    <CardTitle>Edit Maintenance Issue</CardTitle>
                    <CardDescription>Update the details for this maintenance log.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
                            <FormField control={form.control} name="title" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Issue Title</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <FormField control={form.control} name="description" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl><Textarea rows={4} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={form.control} name="category" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other'].map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="priority" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>{['Emergency', 'Urgent', 'Routine', 'Low'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            {watchCategory === 'Other' && (
                              <FormField
                                control={form.control}
                                name="otherCategoryDetails"
                                render={({ field }) => (
                                  <FormItem className="animate-in fade-in slide-in-from-top-2">
                                    <FormLabel>Category Details</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        placeholder="Specify details for the 'Other' category..."
                                        className="resize-none bg-muted/50"
                                        {...field}
                                        value={field.value ?? ''}
                                      />
                                    </FormControl>
                                    <FormDescription>Please describe the specialized trade required.</FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>{['Open', 'In Progress', 'Completed', 'Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <Card className="bg-muted/30 border-dashed">
                                <CardHeader><CardTitle className="text-lg">Contractor & Scheduling</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <FormItem>
                                        <FormLabel>Select a saved contractor</FormLabel>
                                        <Select onValueChange={(contractorId) => {
                                            const contractor = contractors?.find(c => c.id === contractorId);
                                            if (contractor) {
                                                form.setValue('contractorName', contractor.name);
                                                form.setValue('contractorPhone', contractor.phone);
                                            }
                                        }}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select from your directory" /></SelectTrigger></FormControl>
                                            <SelectContent>{contractors?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.trade})</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="contractorName" render={({ field }) => (<FormItem><FormLabel>Contractor Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="contractorPhone" render={({ field }) => (<FormItem><FormLabel>Contractor Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Scheduled Date</FormLabel>
                                                <FormControl>
                                                    <Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name="estimatedCost" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estimated Cost (£)</FormLabel>
                                                <FormControl>
                                                    <Input type="text" inputMode="decimal" placeholder="150.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" asChild><Link href={`/dashboard/maintenance/${logId}?propertyId=${propertyId}`}>Cancel</Link></Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
