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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';


const screeningEditSchema = z.object({
  screeningDate: z.coerce.date(),
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

type ScreeningEditFormValues = z.infer<typeof screeningEditSchema>;

const ChecklistItem = ({ form, name, label }: { form: any, name: any, label: string }) => (
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
                    <Textarea placeholder={placeholder} {...field} value={field.value ?? ''}/>
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);

const convertTimestampsToDates = (obj: any): any => {
    if (!obj) return obj;
    const newObj: { [key: string]: any } = { ...obj };
    for (const key in newObj) {
        if (Object.prototype.hasOwnProperty.call(newObj, key)) {
            const value = newObj[key];
            if (value instanceof Timestamp) {
                newObj[key] = value.toDate();
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                newObj[key] = convertTimestampsToDates(value);
            }
        }
    }
    return newObj;
};

export default function EditTenantScreeningPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const tenantId = params.id as string;
    const screeningId = params.screeningId as string;
    const propertyId = searchParams.get('propertyId');
    const { user } = useUser();
    const firestore = useFirestore();

    const form = useForm<ScreeningEditFormValues>({
        resolver: zodResolver(screeningEditSchema),
    });

    const screeningRef = useMemoFirebase(() => {
        if (!firestore || !user || !tenantId || !screeningId || !propertyId) return null;
        // Strictly hierarchical path fix
        return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId, 'screenings', screeningId);
    }, [firestore, user, tenantId, screeningId, propertyId]);
    const { data: screening, isLoading: isLoadingScreening, error: screeningError } = useDoc(screeningRef);

    const tenantRef = useMemoFirebase(() => {
        if (!firestore || !user || !tenantId || !propertyId) return null;
        return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'tenants', tenantId);
    }, [firestore, user, tenantId, propertyId]);
    const { data: tenant, isLoading: isLoadingTenant } = useDoc(tenantRef);

    useEffect(() => {
        if (screening) {
            const dataWithDates = convertTimestampsToDates(screening);
            form.reset({
                ...dataWithDates,
                rightToRent: dataWithDates.rightToRent || {},
                idVerification: dataWithDates.idVerification || {},
                creditCheck: dataWithDates.creditCheck || {},
                employmentIncome: dataWithDates.employmentIncome || {},
                landlordReference: dataWithDates.landlordReference || {},
                addressHistory: dataWithDates.addressHistory || {},
                affordability: dataWithDates.affordability || {},
                guarantor: dataWithDates.guarantor || {},
            });
        }
    }, [screening, form]);


    async function onSubmit(data: ScreeningEditFormValues) {
        if (!screeningRef) return;

        const cleanedData = JSON.parse(JSON.stringify(data));

        updateDoc(screeningRef, cleanedData)
          .then(() => {
            toast({
                title: 'Screening Record Updated',
                description: 'The screening checklist has been successfully updated.',
            });
            router.push(`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`);
          })
          .catch(async (serverError) => {
             const permissionError = new FirestorePermissionError({
                path: screeningRef.path,
                operation: 'update',
                requestResourceData: cleanedData,
            });
            errorEmitter.emit('permission-error', permissionError);
             toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: serverError.message || 'An unexpected error occurred.',
            });
          });
    }
    
    const isLoading = isLoadingScreening || isLoadingTenant;

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (screeningError || !propertyId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
                <h2 className="text-lg font-bold">Access Error</h2>
                <p className="text-sm text-muted-foreground max-w-xs">There was an error accessing the screening record. Property context might be missing.</p>
                <Button asChild variant="outline"><Link href="/dashboard/tenants">Return to Tenants</Link></Button>
            </div>
        );
    }

    if (!screening || !tenant) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-6 p-6 text-center">
                <div className="bg-muted p-6 rounded-full">
                    <AlertCircle className="h-12 w-12 text-muted-foreground opacity-20" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold">Record Not Found</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto">This screening report may have been deleted or is inaccessible.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/dashboard/tenants">Return to Tenants List</Link>
                </Button>
            </div>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Edit Tenant Screening</CardTitle>
                <CardDescription>
                    Update the screening checklist for {tenant.name}.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                         <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                            <h3 className="font-semibold">Screening For</h3>
                            <p className="font-medium text-sm">{tenant.name}</p>
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
                                <Link href={`/dashboard/tenants/${tenantId}?propertyId=${propertyId}`}>Cancel</Link>
                            </Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
