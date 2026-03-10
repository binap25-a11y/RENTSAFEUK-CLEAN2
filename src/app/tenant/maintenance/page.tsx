'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Loader2, Wrench, Upload, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collectionGroup, query, where, limit, addDoc, collection, onSnapshot } from 'firebase/firestore';
import { uploadPropertyImage } from '@/lib/upload-image';
import Image from 'next/image';

const maintenanceSchema = z.object({
  title: z.string().min(3, 'Issue title is too short'),
  description: z.string().min(5, 'Please provide more detail for the contractor'),
  category: z.string({ required_error: 'Please select a category.' }),
  priority: z.string({ required_error: 'Please select a priority.' }),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

export default function TenantMaintenancePage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: { title: '', description: '', category: '', priority: 'Routine' }
  });

  useEffect(() => {
    if (!user || !firestore || !user.email) {
      setIsLoadingContext(false);
      return;
    }
    
    const userEmail = user.email.toLowerCase().trim();

    // Search for tenants linked to this email.
    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', userEmail),
        limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
        const activeTenant = snap.docs.find(d => d.data().status === 'Active');
        if (activeTenant) {
            const data = activeTenant.data();
            const path = activeTenant.ref.path.split('/');
            // Path: userProfiles/{landlordId}/properties/{propertyId}/tenants/{tenantId}
            setTenantContext({ 
                landlordId: path[1], 
                propertyId: path[3], 
                tenantId: activeTenant.id,
                email: data.email 
            });
        }
        setIsLoadingContext(false);
    }, (error) => {
        console.warn("Tenant portal discovery inhibited:", error.message);
        setIsLoadingContext(false);
    });

    return () => unsub();
  }, [user, firestore]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotoFiles(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setPhotoPreviews(prev => [...prev, ...previews]);
  };

  const removePhoto = (idx: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    if (photoPreviews[idx].startsWith('blob:')) URL.revokeObjectURL(photoPreviews[idx]);
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  async function onSubmit(data: MaintenanceFormValues) {
    if (!tenantContext || !user) {
      toast({ variant: 'destructive', title: 'Portal Sync Error', description: 'Could not resolve your tenancy record.' });
      return;
    }
    setIsSubmitting(true);

    try {
      let photoUrls: string[] = [];
      if (photoFiles.length > 0) {
        const uploads = await Promise.all(photoFiles.map(f => uploadPropertyImage(f, tenantContext.landlordId, tenantContext.propertyId)));
        photoUrls = uploads.filter((u): u is string => !!u);
      }

      const logsCollection = collection(firestore, 'userProfiles', tenantContext.landlordId, 'properties', tenantContext.propertyId, 'maintenanceLogs');
      
      await addDoc(logsCollection, {
        ...data,
        userId: tenantContext.landlordId,
        propertyId: tenantContext.propertyId,
        reportedBy: user.uid,
        tenantEmail: tenantContext.email || user.email?.toLowerCase(),
        reportedDate: new Date().toISOString(),
        status: 'Open',
        photoUrls
      });

      toast({ title: 'Repair Requested', description: 'Your landlord has been notified.' });
      router.push('/tenant/dashboard');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Submission Failed' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingContext) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Portal Access...</p>
      </div>
    );
  }

  if (!tenantContext) {
    return (
      <Card className="max-w-md mx-auto mt-10 shadow-lg border-none text-center">
        <CardHeader className="bg-muted/20">
          <CardTitle className="text-lg">Portal Access Limited</CardTitle>
          <CardDescription>We could not verify your active tenancy. Please contact your landlord to verify your portal email.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-xl border-none">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="flex items-center gap-2 font-headline"><Wrench className="h-5 w-5 text-primary" /> Report a Problem</CardTitle>
        <CardDescription>Tell us what's wrong and we'll arrange for a contractor to visit.</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel className="font-bold">What is the issue?</FormLabel><FormControl><Input placeholder="e.g. Leaking kitchen tap" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>{['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Other'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Urgency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="Emergency">Emergency (Immediate Risk)</SelectItem><SelectItem value="Urgent">Urgent (Needs fix today)</SelectItem><SelectItem value="Routine">Routine (General repair)</SelectItem></SelectContent>
                    </Select>
                  <FormMessage /></FormItem>
                )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel className="font-bold">Describe the problem</FormLabel><FormControl><Textarea rows={4} placeholder="Please provide as much detail as possible for the landlord and contractor..." className="resize-none rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="space-y-4">
                <FormLabel className="font-bold">Attach Photos (Optional)</FormLabel>
                <div className="grid grid-cols-3 gap-4">
                    {photoPreviews.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm">
                            <Image src={url} alt="Preview" fill className="object-cover" unoptimized />
                            <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePhoto(idx)}><X className="h-3 w-3" /></Button>
                        </div>
                    ))}
                    <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 bg-muted/5 cursor-pointer aspect-square hover:bg-muted/10 transition-colors" onClick={() => document.getElementById('tenant-photo-upload')?.click()}>
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">Add Photo</span>
                    </div>
                </div>
                <input id="tenant-photo-upload" type="file" multiple className="hidden" accept="image/*" onChange={handlePhotoChange} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" className="font-bold uppercase tracking-widest text-xs h-11" onClick={() => router.push('/tenant/dashboard')}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="h-11 px-10 shadow-lg font-bold uppercase tracking-widest text-xs">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Report Issue'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
