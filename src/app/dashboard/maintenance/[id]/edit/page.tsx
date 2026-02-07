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
import { Upload, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useStorage,
  useCollection,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';

const maintenanceEditSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
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
  priority: string;
  status: string;
  reportedBy?: string;
  reportedDate: Timestamp | Date;
  contractorName?: string;
  contractorPhone?: string;
  scheduledDate?: Timestamp | Date;
  estimatedCost?: number;
  photoUrls?: string[];
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
    const storage = useStorage();

    const logId = params.id as string;
    const propertyId = searchParams.get('propertyId');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [newPhotosToUpload, setNewPhotosToUpload] = useState<FileList | null>(null);
    const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);

    const form = useForm<MaintenanceFormValues>({
        resolver: zodResolver(maintenanceEditSchema),
    });

    const maintenanceLogRef = useMemoFirebase(() => {
        if (!firestore || !propertyId || !logId) return null;
        return doc(firestore, 'properties', propertyId, 'maintenanceLogs', logId);
    }, [firestore, propertyId, logId]);

    const { data: maintenanceLog, isLoading: isLoadingLog } = useDoc<MaintenanceLog>(maintenanceLogRef);

    const contractorsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'contractors'), where('ownerId', '==', user.uid));
    }, [firestore, user]);
    const { data: contractors } = useCollection<Contractor>(contractorsQuery);

    useEffect(() => {
        if (maintenanceLog) {
            form.reset({
                ...maintenanceLog,
                description: maintenanceLog.description ?? '',
                reportedBy: maintenanceLog.reportedBy ?? '',
                contractorName: maintenanceLog.contractorName ?? '',
                contractorPhone: maintenanceLog.contractorPhone ?? '',
                notes: maintenanceLog.notes ?? '',
                reportedDate: maintenanceLog.reportedDate instanceof Date ? maintenanceLog.reportedDate : new Date(maintenanceLog.reportedDate.seconds * 1000),
                scheduledDate: maintenanceLog.scheduledDate ? (maintenanceLog.scheduledDate instanceof Date ? maintenanceLog.scheduledDate : new Date(maintenanceLog.scheduledDate.seconds * 1000)) : undefined,
                estimatedCost: maintenanceLog.estimatedCost ?? undefined,
            });
            if (maintenanceLog.photoUrls) {
                setExistingPhotos(maintenanceLog.photoUrls);
            }
        }
    }, [maintenanceLog, form]);

    async function onSubmit(data: MaintenanceFormValues) {
        if (!user || !firestore || !storage || !maintenanceLogRef) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save. Please try again.' });
            return;
        }
        setIsSubmitting(true);
        try {
            let finalPhotoUrls = existingPhotos;
            if (newPhotosToUpload && newPhotosToUpload.length > 0) {
                 toast({
                    title: 'Uploading new photos...',
                    description: `Uploading ${newPhotosToUpload.length} photo(s). This will replace any existing photos.`,
                });
                
                const uploadPromises = Array.from(newPhotosToUpload).map(async (file) => {
                    const uniqueFileName = `${Date.now()}-${file.name}`;
                    const fileStorageRef = storageRef(storage, `maintenance/${user.uid}/${uniqueFileName}`);
                    await uploadBytes(fileStorageRef, file);
                    return getDownloadURL(fileStorageRef);
                });
                
                finalPhotoUrls = await Promise.all(uploadPromises);
            }

            await updateDoc(maintenanceLogRef, { ...data, photoUrls: finalPhotoUrls });

            toast({ title: 'Maintenance Log Updated', description: 'The changes have been saved.' });
            router.push(`/dashboard/maintenance/${logId}?propertyId=${propertyId}`);
        } catch (error) {
            console.error('Failed to update maintenance log', error);
            const anyError = error as any;
            toast({ variant: 'destructive', title: 'Update Failed', description: anyError.message || 'There was an error updating the log.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoadingLog) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    if (!maintenanceLog) {
        return <div className="text-center py-10">Maintenance log not found.</div>;
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Edit Maintenance Issue</CardTitle>
                <CardDescription>Update the details for this maintenance log.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        
                        <Card>
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
                                                <Input
                                                    type="date"
                                                    value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => field.onChange(e.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="estimatedCost" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Estimated Cost (£)</FormLabel>
                                            <FormControl>
                                                <Input type="text" inputMode="decimal" placeholder="150.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Photos</CardTitle></CardHeader>
                            <CardContent>
                                {(newPhotoPreviews.length > 0 || existingPhotos.length > 0) && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                                        {(newPhotoPreviews.length > 0 ? newPhotoPreviews : existingPhotos).map((url, index) => (
                                            <div key={index} className="relative aspect-square">
                                                <Image src={url} alt={`Photo ${index + 1}`} fill className="rounded-md object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <FormItem>
                                    <FormLabel>{existingPhotos.length > 0 ? 'Upload New Photos (replaces old ones)' : 'Upload Photos'}</FormLabel>
                                    <Button asChild variant="outline" className="w-full">
                                        <label htmlFor="photos-upload" className="cursor-pointer flex items-center justify-center gap-2">
                                            <Upload className="h-4 w-4" />
                                            Choose Files
                                            <Input 
                                                id="photos-upload" 
                                                type="file" 
                                                multiple 
                                                accept="image/*" 
                                                className="sr-only" 
                                                onChange={(e) => { 
                                                    const files = e.target.files;
                                                    setNewPhotosToUpload(files);
                                                    if (files && files.length > 0) {
                                                        const fileArray = Array.from(files);
                                                        const previews = fileArray.map(file => URL.createObjectURL(file));
                                                        setNewPhotoPreviews(previews);
                                                    } else {
                                                        setNewPhotoPreviews([]);
                                                    }
                                                }}
                                            />
                                        </label>
                                    </Button>
                                </FormItem>
                            </CardContent>
                        </Card>

                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl><Textarea rows={4} {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" asChild><Link href={`/dashboard/maintenance/${logId}?propertyId=${propertyId}`}>Cancel</Link></Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
