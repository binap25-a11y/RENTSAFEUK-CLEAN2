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
import { Loader2, Wand2, List } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, query, where, addDoc, limit } from 'firebase/firestore';
import { MaintenanceAssistantDialog } from '@/components/dashboard/maintenance-assistant-dialog';
import type { MaintenanceAssistantOutput } from '@/ai/flows/maintenance-assistant-flow';


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

// Type for property documents from Firestore
interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
  ownerId: string;
  status: string;
}

// Type for contractor documents from Firestore
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
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
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
      reportedDate: new Date(),
    },
  });

  // Fetch properties for the dropdowns
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const properties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  // Fetch contractors for the dropdown
  const contractorsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'contractors'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);
  const { data: contractors } = useCollection<Contractor>(contractorsQuery);

  const handleLogFromAssistant = (suggestion: MaintenanceAssistantOutput) => {
    form.setValue('title', suggestion.suggestedTitle);
    const description = `AI Diagnosis:\n- ${suggestion.likelyCause}\n\nSuggested Troubleshooting:\n- ${suggestion.troubleshootingSteps.join('\n- ')}`;
    form.setValue('description', description);
    form.setValue('priority', suggestion.urgency);
    form.setValue('category', suggestion.suggestedCategory);
    setIsAssistantOpen(false);
    toast({
      title: 'Form Pre-filled',
      description: 'The maintenance form has been pre-filled with the AI suggestions.',
    });
  };

  async function handleFormSubmit(data: MaintenanceFormValues) {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
      return;
    }
    setIsSubmitting(true);

    try {
      const newLog = { ...data, ownerId: user.uid, status: 'Open' };
      const logsCollection = collection(firestore, 'properties', data.propertyId, 'maintenanceLogs');
      const newDocRef = await addDoc(logsCollection, newLog);

      toast({ title: 'Maintenance Logged', description: 'The new maintenance issue has been successfully logged.' });
      router.push(`/dashboard/maintenance/${newDocRef.id}?propertyId=${data.propertyId}`);

    } catch (error) {
      console.error('Failed to log maintenance issue:', error);
      const permissionError = new FirestorePermissionError({ path: 'maintenance', operation: 'create', requestResourceData: data });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: 'destructive', title: 'Save Failed', description: (error as Error).message || 'An error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold font-headline">Maintenance</h1>
            <p className="text-muted-foreground">
              Manage repairs and maintenance tasks across your portfolio.
            </p>
          </div>
        </div>

        <MaintenanceAssistantDialog 
            isOpen={isAssistantOpen} 
            onOpenChange={setIsAssistantOpen}
            onLogIssue={handleLogFromAssistant}
        />
        <Card>
          <CardHeader>
            <CardTitle>Log Maintenance Issue</CardTitle>
            <CardDescription>
              Fill in the details below or use our AI assistant to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <Button onClick={() => setIsAssistantOpen(true)} variant="outline">
                  <Wand2 className="mr-2 h-4 w-4" />
                  AI Assistant
              </Button>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Issue Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="propertyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingProperties ? 'Loading properties...' : 'Select a property'} />
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
                    <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Issue Title</FormLabel><FormControl><Input placeholder="e.g., Leaking kitchen sink" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Provide a detailed description of the issue." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl><SelectContent>{['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other'].map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a priority" /></SelectTrigger></FormControl><SelectContent>{['Emergency', 'Urgent', 'Routine', 'Low'].map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-xl">Reporting Information</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="reportedBy" render={({ field }) => (<FormItem><FormLabel>Reported By</FormLabel><FormControl><Input placeholder="e.g., Tenant name" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="reportedDate" render={({ field }) => (<FormItem><FormLabel>Reported Date</FormLabel><FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-xl">Contractor Information</CardTitle></CardHeader>
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
                          <SelectContent>{contractors?.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name} ({c.trade})</SelectItem>))}</SelectContent>
                        </Select>
                        <FormDescription>Or enter new contractor details below.</FormDescription>
                      </FormItem>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="contractorName" render={({ field }) => (<FormItem><FormLabel>Contractor Name</FormLabel><FormControl><Input placeholder="e.g., ABC Plumbers" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="contractorPhone" render={({ field }) => (<FormItem><FormLabel>Contractor Phone</FormLabel><FormControl><Input placeholder="07123456789" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="scheduledDate" render={({ field }) => (<FormItem><FormLabel>Scheduled Date</FormLabel><FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="estimatedCost" render={({ field }) => (<FormItem><FormLabel>Estimated Cost (£)</FormLabel><FormControl><Input type="text" inputMode="decimal" placeholder="150.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => form.reset()}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="flex justify-center pt-4">
            <Button asChild variant="default" className="w-full sm:w-auto">
                <Link href="/dashboard/maintenance/logged">
                    <List className="mr-2 h-4 w-4" /> View Maintenance Logged
                </Link>
            </Button>
        </div>
      </div>
    </>
  );
}
