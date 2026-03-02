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
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect } from 'react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const checklistSchema = z.object({
  propertyId: z.string().min(1, { message: 'A property must be selected.' }),
  tenantId: z.string().min(1, { message: 'A tenant must be selected.' }),
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
          <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
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
          <Textarea placeholder={placeholder} {...field} value={field.value ?? ''} />
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [formDataToSave, setFormDataToSave] = useState<ChecklistFormValues | null>(null);

  const form = useForm<ChecklistFormValues>({
    resolver: zodResolver(checklistSchema),
    defaultValues: {
      propertyId: propertyIdFromUrl || '',
      tenantId: tenantIdFromUrl || '',
      beforeTenancy: {},
      deposit: {},
      atMoveIn: {},
      optional: {},
    },
  });

  useEffect(() => {
    form.setValue('completedDate', new Date());
  }, [form]);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !user || !propertyIdFromUrl) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyIdFromUrl);
  }, [firestore, user, propertyIdFromUrl]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !user || !propertyIdFromUrl || !tenantIdFromUrl) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyIdFromUrl, 'tenants', tenantIdFromUrl);
  }, [firestore, user, propertyIdFromUrl, tenantIdFromUrl]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  async function proceedToSave(data: ChecklistFormValues) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to save a checklist.',
      });
      return;
    }

    setIsSubmitting(true);
    
    const cleanedData = JSON.parse(JSON.stringify({
        ...data,
        ownerId: user.uid,
    }));

    const checklistsCollection = collection(firestore, 'userProfiles', user.uid, 'properties', data.propertyId, 'checklists');

    addDoc(checklistsCollection, cleanedData)
      .then(() => {
        toast({
          title: 'Checklist Saved',
          description: 'The pre-tenancy checklist has been successfully saved.',
        });
        router.push(`/dashboard/tenants/${data.tenantId}?propertyId=${data.propertyId}`);
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: checklistsCollection.path,
          operation: 'create',
          requestResourceData: cleanedData,
        });
        errorEmitter.emit('permission-error', permissionError);

        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: serverError.message || 'An unexpected error occurred.',
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  async function onSubmit(data: ChecklistFormValues) {
    const requiredSections = ['beforeTenancy', 'deposit', 'atMoveIn'] as const;
    let allRequiredTicked = true;

    for (const sectionName of requiredSections) {
        const sectionData = data[sectionName];
        if (sectionData) {
            for (const key in sectionData) {
                if (typeof sectionData[key as keyof typeof sectionData] === 'boolean') {
                    if (!sectionData[key as keyof typeof sectionData]) {
                        allRequiredTicked = false;
                        break;
                    }
                }
            }
        }
        if (!allRequiredTicked) break;
    }

    if (allRequiredTicked) {
      await proceedToSave(data);
    } else {
      setFormDataToSave(data);
      setIsConfirmDialogOpen(true);
    }
  }

  const handleConfirmSave = async () => {
    setIsConfirmDialogOpen(false);
    if (formDataToSave) {
        await proceedToSave(formDataToSave);
    }
    setFormDataToSave(null);
  };

  if (!propertyIdFromUrl || !tenantIdFromUrl) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Invalid Checklist</CardTitle>
          <CardDescription>
            To create a checklist, please start from a specific tenant's detail page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/dashboard/tenants">Go to Tenants</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
              <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                <h3 className="font-semibold">Checklist For</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Property</p>
                    <p className="font-medium">
                      {isLoadingProperty ? <Loader2 className="h-4 w-4 animate-spin" /> : property?.address ? [property.address.nameOrNumber, property.address.street, property.address.city].filter(Boolean).join(", ") : 'Property not found'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tenant</p>
                    <p className="font-medium">
                      {isLoadingTenant ? <Loader2 className="h-4 w-4 animate-spin" /> : tenant?.name || 'Tenant not found'}
                    </p>
                  </div>
                </div>
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
                  <Link href={`/dashboard/tenants/${tenantIdFromUrl}?propertyId=${propertyIdFromUrl}`}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Checklist
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={(open) => {
        setIsConfirmDialogOpen(open);
        if (!open) {
            setFormDataToSave(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incomplete Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              Some essential checklist items are not ticked. Are you sure you want to save anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFormDataToSave(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}