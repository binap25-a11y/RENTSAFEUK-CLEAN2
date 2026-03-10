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
import { Loader2, Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useUser,
  useFirestore,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
  useDoc,
} from '@/firebase';
import { collection, addDoc, doc } from 'firebase/firestore';
import { useEffect, useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';

const screeningSchema = z.object({
  tenantId: z.string({ required_error: 'Please select a tenant.' }).min(1, "Please select a tenant."),
  propertyId: z.string({ required_error: 'Property ID is missing.' }).min(1),
  screeningDate: z.coerce.date(),
  monthlyIncome: z.coerce.number().min(0, "Income cannot be negative").optional(),
  rightToRent: z.object({
    checkDate: z.coerce.date().optional(),
    ukPassport: z.boolean().default(false),
    shareCode: z.boolean().default(false),
    visaPermit: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  idVerification: z.object({
    photoMatch: z.boolean().default(false),
    nameMatch: z.boolean().default(false),
    dobConsistent: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  creditCheck: z.object({
    agencyUsed: z.string().optional(),
    reportReceived: z.boolean().default(false),
    passed: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  employmentIncome: z.object({
    bankStatements: z.boolean().default(false),
    payslips: z.boolean().default(false),
    employmentContract: z.boolean().default(false),
    employerReference: z.boolean().default(false),
    sa302: z.boolean().default(false),
    accountantReference: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  landlordReference: z.object({
    name: z.string().optional(),
    email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
    phone: z.string().optional(),
    rentOnTime: z.boolean().default(false),
    anyArrears: z.boolean().default(false),
    propertyConditionGood: z.boolean().default(false),
    wouldRentAgain: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  addressHistory: z.object({
    verified: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  affordability: z.object({
    passed: z.boolean().default(false),
    guarantorConsidered: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  guarantor: z.object({
    required: z.boolean().default(false),
    idCheck: z.boolean().default(false),
    creditCheck: z.boolean().default(false),
    incomeVerified: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),
  overallNotes: z.string().optional(),
});

type ScreeningFormValues = z.infer<typeof screeningSchema>;

interface Tenant {
  id: string;
  name: string;
  monthlyRent?: number;
  propertyId: string;
}

// Utility to clean undefined values before Firestore writes
const prepareForFirestore = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value === undefined) return null;
        return value;
    }));
};

const ChecklistItem = ({ form, name, label }: { form: any, name: any, label: string }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
        <FormControl>
            <Checkbox checked={!!form.watch(name)} onCheckedChange={(val) => form.setValue(name, val)} />
        </FormControl>
        <div className="space-y-1 leading-none">
            <FormLabel className="font-normal">{label}</FormLabel>
        </div>
    </FormItem>
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

export default function TenantScreeningPageWrapper() {
  const searchParams = useSearchParams();
  const tenantIdFromUrl = searchParams.get('tenantId');
  const propertyIdFromUrl = searchParams.get('propertyId');

  return <TenantScreeningPage key={tenantIdFromUrl} tenantIdFromUrl={tenantIdFromUrl} propertyIdFromUrl={propertyIdFromUrl} />;
}

function TenantScreeningPage({ tenantIdFromUrl, propertyIdFromUrl }: { tenantIdFromUrl: string | null, propertyIdFromUrl: string | null }) {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();

    const form = useForm<ScreeningFormValues>({
        resolver: zodResolver(screeningSchema),
        defaultValues: {
            tenantId: tenantIdFromUrl || '',
            propertyId: propertyIdFromUrl || '',
            monthlyIncome: undefined,
        }
    });

    const watchIncome = form.watch('monthlyIncome');

    useEffect(() => {
        form.setValue('screeningDate', new Date());
    }, [form]);

    const tenantRef = useMemoFirebase(() => {
        if (!firestore || !user || !tenantIdFromUrl || !propertyIdFromUrl) return null;
        return doc(firestore, 'userProfiles', user.uid, 'properties', propertyIdFromUrl, 'tenants', tenantIdFromUrl);
    }, [firestore, user, tenantIdFromUrl, propertyIdFromUrl]);
    const { data: selectedTenant, isLoading: isLoadingSelectedTenant } = useDoc<Tenant>(tenantRef);

    useEffect(() => {
        if (selectedTenant && !form.getValues('propertyId')) {
            form.setValue('propertyId', selectedTenant.propertyId);
        }
    }, [selectedTenant, form]);

    const affordabilityMetrics = useMemo(() => {
        const rent = selectedTenant?.monthlyRent || 0;
        const income = watchIncome || 0;
        if (!rent || !income) return null;
        
        const ratio = (rent / income) * 100;
        const isRisky = ratio > 40;
        
        return {
            ratio: ratio.toFixed(1),
            isRisky
        };
    }, [selectedTenant, watchIncome]);

    async function onSubmit(data: ScreeningFormValues) {
        if (!user || !firestore) {
            toast({
                variant: 'destructive',
                title: 'Authentication Error',
                description: 'You must be logged in to save a screening record.',
            });
            return;
        }

        const { tenantId, propertyId, ...screeningData } = data;

        const cleanedSubmission = prepareForFirestore({
            ...screeningData,
            userId: user.uid,
            tenantId: tenantId,
            propertyId: propertyId,
        });

        const screeningsCollection = collection(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId, 'screenings');

        addDoc(screeningsCollection, cleanedSubmission)
          .then(() => {
            toast({
                title: 'Screening Audit Saved',
                description: 'The tenant vetting checklist has been successfully recorded.',
            });
            router.push(`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`);
          })
          .catch(async (serverError) => {
             const permissionError = new FirestorePermissionError({
                path: screeningsCollection.path,
                operation: 'create',
                requestResourceData: cleanedSubmission,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: serverError.message || "An error occurred while saving the screening record.",
            });
          });
    }

    if (!tenantIdFromUrl || !propertyIdFromUrl) {
        return (
            <div className="text-center py-20">
                <p className="text-muted-foreground">Tenant selection required. Please start screening from a tenant's profile.</p>
                <Button asChild className="mt-4"><Link href="/dashboard/tenants">Go to Tenants</Link></Button>
            </div>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Tenant Vetting Checklist</CardTitle>
                <CardDescription>
                    Complete and record pre-tenancy audit checks for a prospective tenant.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <FormLabel>Tenant to Screen</FormLabel>
                                <div className="flex items-center justify-between rounded-md border p-3 bg-muted min-h-[40px]">
                                    {isLoadingSelectedTenant ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <div className="flex flex-col text-left">
                                            <p className="font-bold text-sm">{selectedTenant ? selectedTenant.name : 'Tenant not found'}</p>
                                            {selectedTenant?.monthlyRent && <p className="text-[10px] text-muted-foreground uppercase font-bold">Base Rent: £{selectedTenant.monthlyRent}/mo</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="screeningDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date of Audit</FormLabel>
                                        <FormControl>
                                            <Input
                                                id="screening-date-input"
                                                name="screeningDate"
                                                type="date"
                                                className="h-11"
                                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                                onChange={(e) => field.onChange(e.target.value)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Card className="bg-muted/30 border-dashed">
                            <CardHeader className="pb-3 text-left">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calculator className="h-4 w-4 text-primary" />
                                    Affordability Analysis
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="monthlyIncome"
                                        render={({ field }) => (
                                            <FormItem className="text-left">
                                                <FormLabel>Tenant Net Monthly Income (£)</FormLabel>
                                                <FormControl>
                                                    <Input id="screening-income-input" name="monthlyIncome" type="number" min="0" placeholder="0.00" {...field} value={field.value ?? ''} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {affordabilityMetrics && (
                                        <div className="p-4 rounded-lg bg-background border flex flex-col justify-center text-left">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Rent Coverage</span>
                                                {affordabilityMetrics.isRisky ? (
                                                    <Badge variant="destructive" className="gap-1 font-bold"><AlertTriangle className="h-3 w-3" /> Financial Risk</Badge>
                                                ) : (
                                                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 gap-1 font-bold"><CheckCircle2 className="h-3 w-3" /> Within Bounds</Badge>
                                                )}
                                            </div>
                                            <p className="text-2xl font-bold">{affordabilityMetrics.ratio}%</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {affordabilityMetrics.isRisky ? "Rent exceeds 40% of income. Guarantor is highly recommended." : "Rent is within professional affordability bounds."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Accordion type="multiple" className="w-full space-y-4" defaultValue={['right-to-rent']}>
                            <AccordionItem value="right-to-rent" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Right to Rent Check (Legal)</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4 text-left'>
                                     <FormField
                                        control={form.control}
                                        name="rightToRent.checkDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Date of Manual Verification</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        id="right-to-rent-date"
                                                        name="rightToRentDate"
                                                        type="date"
                                                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                                        onChange={(e) => field.onChange(e.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="rightToRent.ukPassport" label="Verified valid UK Passport" />
                                        <ChecklistItem form={form} name="rightToRent.shareCode" label="Verified via Home Office online check" />
                                        <ChecklistItem form={form} name="rightToRent.visaPermit" label="Verified valid Visa / BRP" />
                                    </div>
                                    <NotesField form={form} name="rightToRent.notes" placeholder="Notes on Right to Rent audit..." />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="id-verification" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>ID Verification</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4 text-left'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="idVerification.photoMatch" label="Photo ID matches applicant" />
                                        <ChecklistItem form={form} name="idVerification.nameMatch" label="Name matches legal documents" />
                                        <ChecklistItem form={form} name="idVerification.dobConsistent" label="DOB consistent across records" />
                                    </div>
                                    <NotesField form={form} name="idVerification.notes" placeholder="Notes on ID audit..." />
                                </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="credit-check" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Credit History Audit</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4 text-left'>
                                    <FormField
                                        control={form.control}
                                        name="creditCheck.agencyUsed"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Agency / Service Used</FormLabel>
                                                <FormControl>
                                                    <Input id="credit-agency-input" name="creditAgency" placeholder="e.g., OpenRent, Experian" {...field} value={field.value ?? ''} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="space-y-4">
                                        <ChecklistItem form={form} name="creditCheck.reportReceived" label="Full report received" />
                                        <ChecklistItem form={form} name="creditCheck.passed" label="Satisfactory credit score" />
                                    </div>
                                    <NotesField form={form} name="creditCheck.notes" placeholder="Notes on credit history..." />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="landlord-reference" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Previous Landlord Reference</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4 text-left'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="landlordReference.name" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Landlord/Agent Name</FormLabel><FormControl><Input id="prev-landlord-name" name="prevLandlordName" placeholder="e.g., John Smith" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="landlordReference.email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input id="prev-landlord-email" name="prevLandlordEmail" type="email" placeholder="john.smith@example.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="landlordReference.phone" render={({ field }) => (<FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input id="prev-landlord-phone" name="prevLandlordPhone" type="tel" placeholder="07123456789" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                                        <ChecklistItem form={form} name="landlordReference.rentOnTime" label="Paid rent on time" />
                                        <ChecklistItem form={form} name="landlordReference.anyArrears" label="No history of arrears" />
                                        <ChecklistItem form={form} name="landlordReference.propertyConditionGood" label="Property maintained well" />
                                        <ChecklistItem form={form} name="landlordReference.wouldRentAgain" label="Would rent to them again" />
                                    </div>
                                    <NotesField form={form} name="landlordReference.notes" placeholder="Notes on reference check..." />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                         <FormField
                            control={form.control}
                            name="overallNotes"
                            render={({ field }) => (
                                <FormItem className="text-left">
                                <FormLabel className='text-lg font-bold text-primary'>Final Vetting Summary & Decision</FormLabel>
                                <FormControl>
                                    <Textarea
                                    id="overall-decision-area"
                                    name="overallNotes"
                                    placeholder="Summarize your final decision and findings for the audit trail..."
                                    className="resize-none rounded-2xl min-h-[150px]"
                                    rows={5}
                                    {...field}
                                    value={field.value ?? ''}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button type="button" variant="ghost" className="font-bold uppercase tracking-widest text-[10px] h-11" asChild>
                                <Link href={`/dashboard/tenants/${tenantIdFromUrl}?propertyId=${propertyIdFromUrl}`}>Cancel Audit</Link>
                            </Button>
                            <Button type="submit" className="font-bold uppercase tracking-widest text-[10px] h-11 px-10 shadow-lg">
                                Save Vetting Audit
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
