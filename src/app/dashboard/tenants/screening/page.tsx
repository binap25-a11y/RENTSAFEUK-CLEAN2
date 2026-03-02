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
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
  useDoc,
} from '@/firebase';
import { collection, query, where, addDoc, doc, collectionGroup } from 'firebase/firestore';
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

const ChecklistItem = ({ form, name, label }: { form: any, name: any, label: string }) => (
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

    // Reliable hierarchical tenant fetch
    const tenantRef = useMemoFirebase(() => {
        if (!firestore || !user || !tenantIdFromUrl || !propertyIdFromUrl) return null;
        return doc(firestore, 'userProfiles', user.uid, 'properties', propertyIdFromUrl, 'tenants', tenantIdFromUrl);
    }, [firestore, user, tenantIdFromUrl, propertyIdFromUrl]);
    const { data: selectedTenant, isLoading: isLoadingSelectedTenant } = useDoc<Tenant>(tenantRef);

    // If tenantId was provided but selectedTenant is missing, we might need a fallback or check propertyId
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

        const newScreeningRecord = {
            ...screeningData,
            ownerId: user.uid,
            tenantId: tenantId,
            propertyId: propertyId,
        };

        const screeningsCollection = collection(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId, 'screenings');

        addDoc(screeningsCollection, newScreeningRecord)
          .then(() => {
            toast({
                title: 'Screening Record Saved',
                description: 'The tenant screening checklist has been successfully saved.',
            });
            router.push(`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`);
          })
          .catch(async (serverError) => {
             const permissionError = new FirestorePermissionError({
                path: screeningsCollection.path,
                operation: 'create',
                requestResourceData: newScreeningRecord,
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
                <CardTitle>Tenant Screening Checklist</CardTitle>
                <CardDescription>
                    Complete and record pre-tenancy checks for a prospective tenant.
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
                                        <div className="flex flex-col">
                                            <p className="font-medium text-sm">{selectedTenant ? selectedTenant.name : 'Tenant not found'}</p>
                                            {selectedTenant?.monthlyRent && <p className="text-[10px] text-muted-foreground uppercase font-bold">Rent: £{selectedTenant.monthlyRent}/mo</p>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="screeningDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date of Screening</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
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
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calculator className="h-4 w-4 text-primary" />
                                    Income & Affordability Check
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="monthlyIncome"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Tenant Monthly Net Income (£)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" min="0" placeholder="0.00" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    {affordabilityMetrics && (
                                        <div className="p-4 rounded-lg bg-background border flex flex-col justify-center">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Rent-to-Income Ratio</span>
                                                {affordabilityMetrics.isRisky ? (
                                                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Risk</Badge>
                                                ) : (
                                                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Clear</Badge>
                                                )}
                                            </div>
                                            <p className="text-2xl font-bold">{affordabilityMetrics.ratio}%</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {affordabilityMetrics.isRisky ? "Rent is over 40% of income. Guarantor recommended." : "Rent is within affordable bounds (under 40%)."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Accordion type="multiple" className="w-full space-y-4" defaultValue={['right-to-rent']}>
                            <AccordionItem value="right-to-rent" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Right to Rent Check (UK Legal Requirement)</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                     <FormField
                                        control={form.control}
                                        name="rightToRent.checkDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Date of Check</FormLabel>
                                                <FormControl>
                                                    <Input
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
                                        <ChecklistItem form={form} name="rightToRent.ukPassport" label="Checked valid UK Passport" />
                                        <ChecklistItem form={form} name="rightToRent.shareCode" label="Used Home Office online check (share code)" />
                                        <ChecklistItem form={form} name="rightToRent.visaPermit" label="Checked valid Visa / Residence Permit" />
                                    </div>
                                    <NotesField form={form} name="rightToRent.notes" placeholder="Notes on Right to Rent check..." />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="id-verification" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>ID Verification</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="idVerification.photoMatch" label="Photo on ID matches applicant" />
                                        <ChecklistItem form={form} name="idVerification.nameMatch" label="Name matches on all documents" />
                                        <ChecklistItem form={form} name="idVerification.dobConsistent" label="Date of Birth is consistent" />
                                    </div>
                                    <NotesField form={form} name="idVerification.notes" placeholder="Notes on ID verification..." />
                                </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="credit-check" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Credit Check</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                    <FormField
                                        control={form.control}
                                        name="creditCheck.agencyUsed"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Agency/Service Used</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g., OpenRent, Experian" {...field} value={field.value ?? ''} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="space-y-4">
                                        <ChecklistItem form={form} name="creditCheck.reportReceived" label="Report Received" />
                                        <ChecklistItem form={form} name="creditCheck.passed" label="Passed" />
                                    </div>
                                    <NotesField form={form} name="creditCheck.notes" placeholder="Notes on credit check..." />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="employment-income" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Employment &amp; Income Check</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="employmentIncome.bankStatements" label="3 months' bank statements" />
                                        <ChecklistItem form={form} name="employmentIncome.payslips" label="3 months' payslips" />
                                        <ChecklistItem form={form} name="employmentIncome.employmentContract" label="Employment contract" />
                                        <ChecklistItem form={form} name="employmentIncome.employerReference" label="Employer reference" />
                                        <ChecklistItem form={form} name="employmentIncome.sa302" label="SA302 / Tax returns (if self-employed)" />
                                        <ChecklistItem form={form} name="employmentIncome.accountantReference" label="Accountant reference (if self-employed)" />
                                        <FormField
                                            control={form.control}
                                            name="employmentIncome.notes"
                                            render={({ field }) => (
                                                <FormItem className="mt-4 sm:col-span-2">
                                                    <FormLabel>Notes</FormLabel>
                                                    <FormControl>
                                                        <Textarea rows={4} placeholder="Notes on income verification..." {...field} value={field.value ?? ''} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                             <AccordionItem value="landlord-reference" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Previous Landlord Reference</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="landlordReference.name" render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Landlord Name</FormLabel><FormControl><Input placeholder="e.g., John Smith" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="landlordReference.email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="john.smith@example.com" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="landlordReference.phone" render={({ field }) => (<FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="tel" placeholder="07123456789" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="landlordReference.rentOnTime" label="Paid rent on time?" />
                                        <ChecklistItem form={form} name="landlordReference.anyArrears" label="Any arrears?" />
                                        <ChecklistItem form={form} name="landlordReference.propertyConditionGood" label="Property kept in good condition?" />
                                        <ChecklistItem form={form} name="landlordReference.wouldRentAgain" label="Would they rent to them again?" />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="landlordReference.notes"
                                        render={({ field }) => (
                                            <FormItem className="mt-4">
                                                <FormLabel>Notes</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        rows={4}
                                                        placeholder="Notes on landlord reference..."
                                                        {...field}
                                                        value={field.value ?? ''}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="address-history" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Address History (3-5 years)</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                    <ChecklistItem form={form} name="addressHistory.verified" label="Address history verified" />
                                    <NotesField form={form} name="addressHistory.notes" placeholder="Notes on address history..." />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="affordability" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Affordability Stress Test</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <p className="text-sm text-muted-foreground mb-4">Could the tenant still pay rent if interest rates rise, their job changes, or benefits are delayed?</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="affordability.passed" label="Passes affordability test" />
                                        <ChecklistItem form={form} name="affordability.guarantorConsidered" label="Guarantor considered/required" />
                                        <FormField
                                            control={form.control}
                                            name="affordability.notes"
                                            render={({ field }) => (
                                                <FormItem className="mt-4 sm:col-span-2">
                                                    <FormLabel>Notes</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            rows={4}
                                                            placeholder="Notes on affordability..."
                                                            {...field}
                                                            value={field.value ?? ''}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="guarantor" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Guarantor Checks (If Needed)</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="guarantor.required" label="Guarantor was required" />
                                        <ChecklistItem form={form} name="guarantor.idCheck" label="Guarantor ID check complete" />
                                        <ChecklistItem form={form} name="guarantor.creditCheck" label="Guarantor credit check complete" />
                                        <ChecklistItem form={form} name="guarantor.incomeVerified" label="Guarantor income verified" />
                                        <FormField
                                            control={form.control}
                                            name="guarantor.notes"
                                            render={({ field }) => (
                                                <FormItem className="sm:col-span-2">
                                                    <FormLabel>Notes</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            rows={4}
                                                            placeholder="Notes on guarantor checks..."
                                                            {...field}
                                                            value={field.value ?? ''}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                         <FormField
                            control={form.control}
                            name="overallNotes"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className='text-lg font-semibold'>Overall Summary &amp; Decision</FormLabel>
                                <FormControl>
                                    <Textarea
                                    placeholder="Summarize your findings and decision here..."
                                    className="resize-none"
                                    rows={5}
                                    {...field}
                                    value={field.value ?? ''}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" asChild>
                                <Link href={`/dashboard/tenants/${tenantIdFromUrl}?propertyId=${propertyIdFromUrl}`}>Cancel</Link>
                            </Button>
                            <Button type="submit">Save Screening Record</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
