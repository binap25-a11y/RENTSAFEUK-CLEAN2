'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';


const screeningSchema = z.object({
  tenantId: z.string({ required_error: 'Please select a tenant.' }),
  screeningDate: z.date(),
  rightToRent: z.object({
    checkDate: z.date().optional(),
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
    email: z.string().optional(),
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
}

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
                    <Textarea placeholder={placeholder} {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);


export default function TenantScreeningPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();

    const form = useForm<ScreeningFormValues>({
        resolver: zodResolver(screeningSchema),
        defaultValues: {
            screeningDate: new Date(),
        }
    });

    const tenantsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'tenants'),
            where('ownerId', '==', user.uid),
            where('status', '==', 'Active')
        );
    }, [firestore, user]);
    const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);


    async function onSubmit(data: ScreeningFormValues) {
        if (!user || !firestore) {
            toast({
                variant: 'destructive',
                title: 'Authentication Error',
                description: 'You must be logged in to save a screening record.',
            });
            return;
        }

        const { tenantId, ...screeningData } = data;

        const newScreeningRecord = {
            ...screeningData,
            ownerId: user.uid,
            tenantId: tenantId,
        };

        try {
            const screeningsCollection = collection(firestore, 'tenants', tenantId, 'screenings');
            await addDocumentNonBlocking(screeningsCollection, newScreeningRecord);
            
            toast({
                title: 'Screening Record Saved',
                description: 'The tenant screening checklist has been successfully saved.',
            });
            router.push('/dashboard/tenants');
        } catch (error) {
            console.error('Failed to save screening record:', error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'There was an error saving the record. Please try again.',
            });
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tenant Screening Checklist</CardTitle>
                <CardDescription>
                    Complete and record pre-tenancy checks for a prospective tenant.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="tenantId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tenant to Screen</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={isLoadingTenants ? <div className='flex items-center gap-2'><Loader2 className='animate-spin' /> Loading...</div> : "Select a tenant"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>{tenants?.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="screeningDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date of Screening</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button suppressHydrationWarning variant={'outline'} className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Accordion type="multiple" className="w-full space-y-4" defaultValue={['right-to-rent']}>
                            <AccordionItem value="right-to-rent" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Right to Rent Check (UK Legal Requirement)</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                     <FormField
                                        control={form.control}
                                        name="rightToRent.checkDate"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col max-w-sm">
                                                <FormLabel>Date of Check</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button suppressHydrationWarning variant={'outline'} className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                                                {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange}/></PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="rightToRent.ukPassport" label="Checked valid UK Passport" />
                                        <ChecklistItem form={form} name="rightToRent.shareCode" label="Used Home Office online check (share code)" />
                                        <ChecklistItem form={form} name="rightToRent.visaPermit" label="Checked valid Visa / Residence Permit" />
                                        <NotesField form={form} name="rightToRent.notes" placeholder="Notes on Right to Rent check..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="id-verification" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>ID Verification</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="idVerification.photoMatch" label="Photo on ID matches applicant" />
                                        <ChecklistItem form={form} name="idVerification.nameMatch" label="Name matches on all documents" />
                                        <ChecklistItem form={form} name="idVerification.dobConsistent" label="Date of Birth is consistent" />
                                        <NotesField form={form} name="idVerification.notes" placeholder="Notes on ID verification..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="credit-check" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Credit Check</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="flex flex-col gap-4">
                                        <FormField control={form.control} name="creditCheck.agencyUsed" render={({ field }) => (<FormItem><FormLabel>Agency/Service Used</FormLabel><FormControl><Input placeholder="e.g., OpenRent, Experian" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <div className="space-y-4">
                                            <ChecklistItem form={form} name="creditCheck.reportReceived" label="Report Received" />
                                            <ChecklistItem form={form} name="creditCheck.passed" label="Passed" />
                                        </div>
                                        <NotesField form={form} name="creditCheck.notes" placeholder="Notes on credit check..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="employment-income" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Employment & Income Check</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="employmentIncome.bankStatements" label="3 months' bank statements" />
                                        <ChecklistItem form={form} name="employmentIncome.payslips" label="3 months' payslips" />
                                        <ChecklistItem form={form} name="employmentIncome.employmentContract" label="Employment contract" />
                                        <ChecklistItem form={form} name="employmentIncome.employerReference" label="Employer reference" />
                                        <ChecklistItem form={form} name="employmentIncome.sa302" label="SA302 / Tax returns (if self-employed)" />
                                        <ChecklistItem form={form} name="employmentIncome.accountantReference" label="Accountant reference (if self-employed)" />
                                        <NotesField form={form} name="employmentIncome.notes" placeholder="Notes on income verification..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                             <AccordionItem value="landlord-reference" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Previous Landlord Reference</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                         <FormField control={form.control} name="landlordReference.name" render={({ field }) => (<FormItem><FormLabel>Landlord Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                         <FormField control={form.control} name="landlordReference.email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl></FormItem>)} />
                                         <FormField control={form.control} name="landlordReference.phone" render={({ field }) => (<FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="tel" {...field} /></FormControl></FormItem>)} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="landlordReference.rentOnTime" label="Paid rent on time?" />
                                        <ChecklistItem form={form} name="landlordReference.anyArrears" label="Any arrears?" />
                                        <ChecklistItem form={form} name="landlordReference.propertyConditionGood" label="Property kept in good condition?" />
                                        <ChecklistItem form={form} name="landlordReference.wouldRentAgain" label="Would they rent to them again?" />
                                        <NotesField form={form} name="landlordReference.notes" placeholder="Notes on landlord reference..." />
                                    </div>
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
                                        <NotesField form={form} name="affordability.notes" placeholder="Notes on affordability..." />
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
                                        <NotesField form={form} name="guarantor.notes" placeholder="Notes on guarantor checks..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                         <FormField
                            control={form.control}
                            name="overallNotes"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className='text-lg font-semibold'>Overall Summary & Decision</FormLabel>
                                <FormControl>
                                    <Textarea
                                    placeholder="Summarize your findings and decision here..."
                                    className="resize-none"
                                    rows={5}
                                    {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" asChild>
                                <Link href="/dashboard/tenants">Cancel</Link>
                            </Button>
                            <Button type="submit">Save Screening Record</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
