'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useState } from 'react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

// Same schema as the add page
const checklistSchema = z.object({
  // propertyId and tenantId are not part of the form, but used for context
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

interface ChecklistData {
    completedDate: Timestamp | Date;
    beforeTenancy?: any;
    deposit?: any;
    atMoveIn?: any;
    optional?: any;
    // ... other fields
}

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

export default function EditChecklistPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();

  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  const tenantId = searchParams.get('tenantId');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ChecklistFormValues>({
    resolver: zodResolver(checklistSchema),
  });

  const checklistRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !id) return null;
    return doc(firestore, 'properties', propertyId, 'checklists', id);
  }, [firestore, propertyId, id]);
  const { data: checklist, isLoading: isLoadingChecklist } = useDoc<ChecklistData>(checklistRef);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  useEffect(() => {
    if (checklist) {
      // Need to convert Firestore Timestamps to JS Dates for the form
      const formData = {
        ...checklist,
        completedDate: checklist.completedDate instanceof Date ? checklist.completedDate : new Date(checklist.completedDate.seconds * 1000),
      };
      form.reset(formData);
    }
  }, [checklist, form]);

  async function onSubmit(data: ChecklistFormValues) {
    if (!user || !firestore || !checklistRef) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to save a checklist.',
      });
      return;
    }

    setIsSubmitting(true);
    
    const cleanedData = JSON.parse(JSON.stringify(data));

    try {
      await updateDoc(checklistRef, cleanedData);
      toast({
        title: 'Checklist Updated',
        description: 'The pre-tenancy checklist has been successfully updated.',
      });
      router.push(`/dashboard/tenants/${tenantId}`);
    } catch (serverError: any) {
        console.error("Error updating checklist:", serverError);
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: serverError.message || 'An unexpected error occurred. Please try again.',
        });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoading = isLoadingChecklist || isLoadingProperty || isLoadingTenant;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!checklist) {
    return <Card className="max-w-4xl mx-auto text-center p-8">
        <CardTitle>Checklist Not Found</CardTitle>
        <CardDescription>This checklist could not be found. It may have been deleted.</CardDescription>
    </Card>
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Pre-Tenancy Checklist</CardTitle>
        <CardDescription>
          Update the details for this checklist.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
              <h3 className="font-semibold">Checklist For</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Property</p>
                  <p className="font-medium">
                    {property?.address ? [property.address.nameOrNumber, property.address.street, property.address.city].filter(Boolean).join(", ") : 'Property not found'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tenant</p>
                  <p className="font-medium">
                    {tenant?.name || 'Tenant not found'}
                  </p>
                </div>
              </div>
            </div>

            <Accordion type="multiple" className="w-full space-y-4" defaultValue={['legal', 'deposit', 'move-in', 'optional']}>
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
                <Link href={`/dashboard/tenants/${tenantId}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
