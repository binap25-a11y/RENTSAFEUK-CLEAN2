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
import { Loader2, List, Wrench, AlertCircle, Calendar, PlusCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, addDoc, limit } from 'firebase/firestore';


// Schema for the form
const maintenanceSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Please select a property.'),
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  priority: z.string({ required_error: 'Please select a priority.' }),
  reportedBy: z.string().optional(),
  reportedDate: z.coerce.date(),
  contractorName: z.string().optional(),
  contractorPhone: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  estimatedCost: z.coerce.number().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
  ownerId: string;
  status: string;
}

interface Contractor {
    id: string;
    name: string;
    phone: string;
    trade: string;
}


export default function MaintenancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      propertyId: '',
      title: '',
      description: '',
      category: '',
      priority: '',
      reportedBy: '',
      contractorName: '',
      contractorPhone: '',
    },
  });

  useEffect(() => {
    form.setValue('reportedDate', new Date());
  }, [form]);

  // Fetch properties - strictly hierarchical
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const properties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  const contractorsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'contractors'),
      limit(500)
    );
  }, [firestore, user]);
  const { data: contractors } = useCollection<Contractor>(contractorsQuery);

  async function handleFormSubmit(data: MaintenanceFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
      const newLog = { ...data, ownerId: user.uid, status: 'Open', createdDate: new Date().toISOString() };
      const logsCollection = collection(firestore, 'userProfiles', user.uid, 'properties', data.propertyId, 'maintenanceLogs');
      const newDocRef = await addDoc(logsCollection, newLog);

      toast({ title: 'Issue Logged', description: 'Maintenance request successfully recorded.' });
      router.push(`/dashboard/maintenance/${newDocRef.id}?propertyId=${data.propertyId}`);

    } catch (error: any) {
      console.error('Failed to log issue:', error);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Permission error. Check property link.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.county, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-headline tracking-tight text-primary flex items-center gap-2">
              <Wrench className="h-8 w-8" />
              Maintenance Hub
          </h1>
          <p className="text-muted-foreground font-medium text-lg">Record and track repairs across your portfolio.</p>
        </div>

        <Card className="border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <CardTitle className="text-xl flex items-center gap-2 text-foreground">
                <AlertCircle className="h-5 w-5 text-primary" />
                Record New Issue
            </CardTitle>
            <CardDescription>
              Detailed documentation helps ensure professional resolution and audit compliance.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
                <div className="grid gap-8">
                    {/* Basic Info */}
                    <div className="space-y-6">
                        <FormField
                        control={form.control}
                        name="propertyId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="font-bold">Select Portfolio Property</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger className="h-11 bg-background">
                                    <SelectValue placeholder={isLoadingProperties ? 'Loading portfolio...' : 'Choose property'} />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {properties?.map((prop) => (
                                    <SelectItem key={prop.id} value={prop.id}>
                                    {formatAddress(prop.address)}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel className="font-bold">Issue Headline</FormLabel><FormControl><Input placeholder="e.g., Leaking boiler in kitchen" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel className="font-bold">Detailed Description</FormLabel><FormControl><Textarea placeholder="Please describe the issue in detail for the contractor." className="min-h-[120px] rounded-xl bg-background" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel className="font-bold">Trade Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Select trade" /></SelectTrigger></FormControl><SelectContent>{['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other'].map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel className="font-bold">Priority Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Select urgency" /></SelectTrigger></FormControl><SelectContent>{['Emergency', 'Urgent', 'Routine', 'Low'].map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    </div>

                    {/* Reporting & Contractor Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-8">
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Audit Information</h3>
                            <FormField control={form.control} name="reportedBy" render={({ field }) => (<FormItem><FormLabel className="font-bold">Reported By</FormLabel><FormControl><Input placeholder="e.g., Tenant name or self" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="reportedDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Date of Report</FormLabel><FormControl><Input type="date" className="h-11 bg-background" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <div className="space-y-6">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-green-600"><PlusCircle className="h-5 w-5" /> Contractor Assign</h3>
                            <FormItem>
                                <FormLabel className="font-bold">Directory Shortcut</FormLabel>
                                <Select onValueChange={(contractorId) => {
                                    const contractor = contractors?.find(c => c.id === contractorId);
                                    if (contractor) {
                                        form.setValue('contractorName', contractor.name);
                                        form.setValue('contractorPhone', contractor.phone);
                                    }
                                }}>
                                <FormControl><SelectTrigger className="h-11 bg-background"><SelectValue placeholder="Quick-select from directory" /></SelectTrigger></FormControl>
                                <SelectContent>{contractors?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} ({c.trade})</SelectItem>))}</SelectContent>
                                </Select>
                            </FormItem>
                            <FormField control={form.control} name="contractorName" render={({ field }) => (<FormItem><FormLabel className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Assigned To</FormLabel><FormControl><Input placeholder="Contractor name" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-8 border-t">
                  <Button type="button" variant="ghost" onClick={() => form.reset()} className="font-bold uppercase tracking-widest text-xs h-11">Clear Form</Button>
                  <Button type="submit" disabled={isSubmitting} className="font-bold uppercase tracking-widest text-xs h-11 px-12 shadow-lg bg-primary hover:bg-primary/90">
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : 'Log Maintenance Request'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Navigation Actions below form card */}
        <div className="px-1">
            <Button asChild variant="outline" className="w-full font-bold shadow-sm h-11 px-6 border-primary/20 hover:bg-primary/5 transition-all">
                <Link href="/dashboard/maintenance/logged">
                    <List className="mr-2 h-4 w-4 text-primary" /> View Maintenance History
                </Link>
            </Button>
        </div>
      </div>
  );
}
