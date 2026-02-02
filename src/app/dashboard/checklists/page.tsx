'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';

const checklistSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }),
  tenantId: z.string({ required_error: 'Please select a tenant.' }),
  completedDate: z.coerce.date(),
  
  beforeTenancy: z.object({
    howToRentGuide: z.boolean().default(false),
    epc: z.boolean().default(false),
    gasSafety: z.boolean().default(false),
    eicr: z.boolean().default(false),
    tenancyAgreement: z.boolean().default(false),
    rightToRent: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  
  deposit: z.object({
    prescribedInfo: z.boolean().default(false),
    schemeLeaflet: z.boolean().default(false),
    protectionCertificate: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  atMoveIn: z.object({
    inventory: z.boolean().default(false),
    keysRecord: z.boolean().default(false),
    emergencyContacts: z.boolean().default(false),
    privacyNotice: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  optional: z.object({
    welcomeLetter: z.boolean().default(false),
    applianceManuals: z.boolean().default(false),
    binInfo: z.boolean().default(false),
    parkingInfo: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
});

type ChecklistFormValues = z.infer<typeof checklistSchema>;

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
}

interface Tenant {
  id: string;
  name: string;
}

const ChecklistField = ({ form, name, label }: { form: any, name: any, label: string }) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
        <FormControl>
          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
        </FormControl>
        <div className="space-y-1 leading-none">
          <FormLabel className="font-normal">{label}</FormLabel>
        </div>
      </FormItem>
    )}
  />
);

const NotesField = ({ form, name, placeholder }: { form: any, name: any, placeholder: string }) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem className="mt-4">
        <FormLabel>Notes</FormLabel>
        <FormControl>
          <Textarea placeholder={placeholder} {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

export default function ChecklistPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();

  const propertyIdFromUrl = searchParams.get('propertyId');
  const tenantIdFromUrl = searchParams.get('tenantId');

  const form = useForm<ChecklistFormValues>({
    resolver: zodResolver(checklistSchema),
    defaultValues: {
      propertyId: propertyIdFromUrl || '',
      tenantId: tenantIdFromUrl || '',
    }
  });

  useEffect(() => {
    form.setValue('completedDate', new Date());
  }, [form]);

  // This query already correctly filters for the logged-in user's properties.
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  // Watch the selected property to filter tenants
  const selectedPropertyId = form.watch('propertyId');
  
  // This query now filters tenants based on the selected property.
  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !selectedPropertyId) return null;
    return query(
        collection(firestore, 'tenants'), 
        where('ownerId', '==', user.uid), 
        where('propertyId', '==', selectedPropertyId),
        where('status', '==', 'Active')
    );
  }, [firestore, user, selectedPropertyId]);
  const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

  async function onSubmit(data: ChecklistFormValues) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to save a checklist.',
      });
      return;
    }

    const checklistDocumentData = { ...data, ownerId: user.uid };

    const checklistsCollection = collection(
      firestore,
      'properties',
      data.propertyId,
      'checklists'
    );

    addDoc(checklistsCollection, checklistDocumentData)
      .then(() => {
        toast({
          title: 'Checklist Saved',
          description: 'The pre-tenancy checklist has been successfully saved.',
        });
        router.push(`/dashboard/tenants/${data.tenantId}`);
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: checklistsCollection.path,
          operation: 'create',
          requestResourceData: checklistDocumentData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>UK Landlord Pre-Tenancy Checklist</CardTitle>
        <CardDescription>
          Complete these essential legal and practical checks before your tenant moves in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties?.map((p) => <SelectItem key={p.id} value={p.id}>{[p.address.nameOrNumber, p.address.street, p.address.city].filter(Boolean).join(", ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPropertyId || isLoadingTenants}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                              !selectedPropertyId 
                                ? 'Select a property first' 
                                : isLoadingTenants 
                                ? 'Loading...' 
                                : 'Select a tenant'
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Accordion type="multiple" className="w-full space-y-4" defaultValue={['legal']}>
              <AccordionItem value="legal" className="border rounded-lg px-4">
                <AccordionTrigger className='text-lg font-semibold'>Before Tenancy Starts (Legal)</AccordionTrigger>
                <AccordionContent className='pt-4 space-y-4'>
                  <ChecklistField form={form} name="beforeTenancy.howToRentGuide" label="How to Rent Guide (latest version)" />
                  <ChecklistField form={form} name="beforeTenancy.epc" label="Energy Performance Certificate (EPC – min E)" />
                  <ChecklistField form={form} name="beforeTenancy.gasSafety" label="Gas Safety Certificate (CP12 – if gas)" />
                  <ChecklistField form={form} name="beforeTenancy.eicr" label="Electrical Safety Report (EICR – valid 5 years)" />
                  <ChecklistField form={form} name="beforeTenancy.tenancyAgreement" label="Signed Tenancy Agreement" />
                  <ChecklistField form={form} name="beforeTenancy.rightToRent" label="Right to Rent check completed & recorded" />
                  <NotesField form={form} name="beforeTenancy.notes" placeholder="Notes for this section..." />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="deposit" className="border rounded-lg px-4">
                <AccordionTrigger className='text-lg font-semibold'>If Taking a Deposit</AccordionTrigger>
                <AccordionContent className='pt-4 space-y-4'>
                  <ChecklistField form={form} name="deposit.prescribedInfo" label="Deposit Prescribed Information" />
                  <ChecklistField form={form} name="deposit.schemeLeaflet" label="Deposit Scheme Leaflet (DPS / TDS / MyDeposits)" />
                  <ChecklistField form={form} name="deposit.protectionCertificate" label="Deposit protection certificate" />
                  <NotesField form={form} name="deposit.notes" placeholder="Notes for this section..." />
                </AccordionContent>
              </AccordionItem>
               <AccordionItem value="move-in" className="border rounded-lg px-4">
                <AccordionTrigger className='text-lg font-semibold'>At / Just After Move-In</AccordionTrigger>
                <AccordionContent className='pt-4 space-y-4'>
                  <ChecklistField form={form} name="atMoveIn.inventory" label="Inventory & Schedule of Condition (signed)" />
                  <ChecklistField form={form} name="atMoveIn.keysRecord" label="Keys issued record" />
                  <ChecklistField form={form} name="atMoveIn.emergencyContacts" label="Emergency & repairs contact details" />
                  <ChecklistField form={form} name="atMoveIn.privacyNotice" label="Privacy Notice (GDPR)" />
                  <NotesField form={form} name="atMoveIn.notes" placeholder="Notes for this section..." />
                </AccordionContent>
              </AccordionItem>
               <AccordionItem value="optional" className="border rounded-lg px-4">
                <AccordionTrigger className='text-lg font-semibold'>Optional but Smart</AccordionTrigger>
                <AccordionContent className='pt-4 space-y-4'>
                  <ChecklistField form={form} name="optional.welcomeLetter" label="Welcome letter" />
                  <ChecklistField form={form} name="optional.applianceManuals" label="Appliance manuals" />
                  <ChecklistField form={form} name="optional.binInfo" label="Bin & recycling info" />
                  <ChecklistField form={form} name="optional.parkingInfo" label="Parking / permit info" />
                  <NotesField form={form} name="optional.notes" placeholder="Notes for this section..." />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/tenants">Cancel</Link>
              </Button>
              <Button type="submit">Save Checklist</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
