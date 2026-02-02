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
} from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';

const hmoInspectionSchema = z.object({
  // General
  inspectionDate: z.coerce.date(),
  inspectorName: z.string().min(1, "Inspector name is required"),
  propertyId: z.string({ required_error: 'Please select a property.' }),
  occupantCount: z.coerce.number().min(1, "Number of occupants is required"),
  licenceExpiryDate: z.coerce.date().optional(),

  // Fire Safety
  fireSafety: z.object({
    interlinkedAlarms: z.boolean().default(false),
    heatDetector: z.boolean().default(false),
    fireDoors: z.boolean().default(false),
    doorSeals: z.boolean().default(false),
    extinguishers: z.boolean().default(false),
    fireBlanket: z.boolean().default(false),
    emergencyLighting: z.boolean().default(false),
    clearRoutes: z.boolean().default(false),
    signage: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  // Communal Areas
  communal: z.object({
    clean: z.boolean().default(false),
    lighting: z.boolean().default(false),
    flooring: z.boolean().default(false),
    noDamp: z.boolean().default(false),
    windows: z.boolean().default(false),
    wasteDisposal: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  // Bedrooms
  bedrooms: z.object({
    doorLock: z.boolean().default(false),
    ventilation: z.boolean().default(false),
    heating: z.boolean().default(false),
    noDamp: z.boolean().default(false),
    furniture: z.boolean().default(false),
    sockets: z.boolean().default(false),
    occupancy: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  // Kitchen
  kitchen: z.object({
    appliances: z.boolean().default(false),
    extractor: z.boolean().default(false),
    sink: z.boolean().default(false),
    cupboards: z.boolean().default(false),
    fridge: z.boolean().default(false),
    storage: z.boolean().default(false),
    fireBlanket: z.boolean().default(false),
    pat: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  // Bathrooms
  bathrooms: z.object({
    toilet: z.boolean().default(false),
    shower: z.boolean().default(false),
    extractor: z.boolean().default(false),
    noLeaks: z.boolean().default(false),
    sealant: z.boolean().default(false),
    hotWater: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  // Utilities
  utilities: z.object({
    boiler: z.boolean().default(false),
    radiators: z.boolean().default(false),
    thermostats: z.boolean().default(false),
    consumerUnit: z.boolean().default(false),
    gasCert: z.boolean().default(false),
    eicr: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  // Exterior
  exterior: z.object({
    roof: z.boolean().default(false),
    pathways: z.boolean().default(false),
    garden: z.boolean().default(false),
    bins: z.boolean().default(false),
    securityLighting: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  // Tenant Responsibilities
  tenantResponsibilities: z.object({
    clean: z.boolean().default(false),
    noSmoking: z.boolean().default(false),
    noPets: z.boolean().default(false),
    noTampering: z.boolean().default(false),
    concerns: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),

  // Follow up
  followUp: z.object({
    repairsRequired: z.boolean().default(false),
    urgentSafetyIssues: z.boolean().default(false),
    maintenanceScheduled: z.boolean().default(false),
    notes: z.string().optional(),
    nextInspectionDate: z.coerce.date().optional(),
  }).optional(),
});

type HmoInspectionFormValues = z.infer<typeof hmoInspectionSchema>;

interface Property {
  id: string;
  address: string;
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
            <FormItem className="mt-4 col-span-1 md:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                    <Textarea placeholder={placeholder} {...field} />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);


export default function HmoInspectionPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();

    const form = useForm<HmoInspectionFormValues>({
        resolver: zodResolver(hmoInspectionSchema),
    });

    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'properties'),
            where('ownerId', '==', user.uid),
            where('propertyType', '==', 'HMO')
        );
    }, [firestore, user]);
    const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

     useEffect(() => {
        form.setValue('inspectionDate', new Date());
     }, [form]);


    async function onSubmit(data: HmoInspectionFormValues) {
        if (!user || !firestore) {
            toast({
                variant: 'destructive',
                title: 'Authentication Error',
                description: 'You must be logged in to save an inspection.',
            });
            return;
        }

        const { propertyId, ...inspectionData } = data;

        const newInspection = {
            ...inspectionData,
            ownerId: user.uid,
            propertyId: propertyId,
            scheduledDate: data.inspectionDate, // Main date for list view
            type: 'HMO',
            status: 'Completed',
        };

        try {
            const inspectionsCollection = collection(firestore, 'properties', propertyId, 'inspections');
            await addDoc(inspectionsCollection, newInspection);
            
            toast({
                title: 'HMO Inspection Saved',
                description: 'The inspection record has been successfully saved.',
            });
            router.push('/dashboard/inspections');
        } catch (error) {
            console.error('Failed to save HMO inspection:', error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'There was an error saving the inspection. Please try again.',
            });
        }
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>HMO Inspection Checklist</CardTitle>
                <CardDescription>
                    Record a detailed inspection for a House in Multiple Occupation.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Accordion type="multiple" className="w-full space-y-4" defaultValue={['general']}>
                            <AccordionItem value="general" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>General Property Information</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="inspectionDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Date of Inspection</FormLabel>
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
                                        <FormField
                                            control={form.control}
                                            name="inspectorName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Inspector Name</FormLabel>
                                                    <FormControl><Input placeholder="e.g., Jane Smith" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="propertyId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Property</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={isLoadingProperties ? <div className='flex items-center gap-2'><Loader2 className='animate-spin' /> Loading...</div> : "Select an HMO property"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>{properties?.map((prop) => (<SelectItem key={prop.id} value={prop.id}>{prop.address}</SelectItem>))}</SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="occupantCount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Number of Occupants</FormLabel>
                                                    <FormControl><Input type="number" placeholder="e.g., 5" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="licenceExpiryDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Licence Expiry Date</FormLabel>
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
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="fire-safety" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Fire Safety (HMO Specific)</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="fireSafety.interlinkedAlarms" label="Interlinked smoke alarms working on each floor" />
                                        <ChecklistItem form={form} name="fireSafety.heatDetector" label="Heat detector in kitchen functioning" />
                                        <ChecklistItem form={form} name="fireSafety.fireDoors" label="Fire doors self-closing and undamaged" />
                                        <ChecklistItem form={form} name="fireSafety.doorSeals" label="Fire door intumescent strips & seals intact" />
                                        <ChecklistItem form={form} name="fireSafety.extinguishers" label="Fire extinguishers serviced & in correct locations" />
                                        <ChecklistItem form={form} name="fireSafety.fireBlanket" label="Fire blanket present in kitchen" />
                                        <ChecklistItem form={form} name="fireSafety.emergencyLighting" label="Emergency lighting tested and operational" />
                                        <ChecklistItem form={form} name="fireSafety.clearRoutes" label="Fire escape routes clear and unobstructed" />
                                        <ChecklistItem form={form} name="fireSafety.signage" label="Fire safety signage displayed where required" />
                                        <NotesField form={form} name="fireSafety.notes" placeholder="Notes on fire safety..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                             <AccordionItem value="communal" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Communal Areas</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="communal.clean" label="Clean and free from hazards" />
                                        <ChecklistItem form={form} name="communal.lighting" label="Adequate lighting" />
                                        <ChecklistItem form={form} name="communal.flooring" label="Flooring in good condition" />
                                        <ChecklistItem form={form} name="communal.noDamp" label="No damp, mould, or condensation" />
                                        <ChecklistItem form={form} name="communal.windows" label="Windows and locks functioning" />
                                        <ChecklistItem form={form} name="communal.wasteDisposal" label="Waste disposal area tidy and accessible" />
                                        <NotesField form={form} name="communal.notes" placeholder="Notes on communal areas..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="bedrooms" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Bedrooms (Per Room)</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <p className="text-sm text-muted-foreground mb-4">Check each bedroom and note any room-specific issues in the notes section.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="bedrooms.doorLock" label="Door lock functioning (thumb-turn recommended)" />
                                        <ChecklistItem form={form} name="bedrooms.ventilation" label="Adequate ventilation" />
                                        <ChecklistItem form={form} name="bedrooms.heating" label="Heating working" />
                                        <ChecklistItem form={form} name="bedrooms.noDamp" label="No signs of damp or mould" />
                                        <ChecklistItem form={form} name="bedrooms.furniture" label="Furniture in good condition" />
                                        <ChecklistItem form={form} name="bedrooms.sockets" label="Electrical sockets safe and undamaged" />
                                        <ChecklistItem form={form} name="bedrooms.occupancy" label="Tenant occupancy confirmed" />
                                        <NotesField form={form} name="bedrooms.notes" placeholder="Notes on bedrooms (specify room numbers)..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="kitchen" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Kitchen</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="kitchen.appliances" label="Cooking appliances working" />
                                        <ChecklistItem form={form} name="kitchen.extractor" label="Extractor fan operational" />
                                        <ChecklistItem form={form} name="kitchen.sink" label="Sinks and taps leak-free" />
                                        <ChecklistItem form={form} name="kitchen.cupboards" label="Worktops & cupboards in good condition" />
                                        <ChecklistItem form={form} name="kitchen.fridge" label="Fridge/freezer clean and functioning" />
                                        <ChecklistItem form={form} name="kitchen.storage" label="Adequate food storage for number of tenants" />
                                        <ChecklistItem form={form} name="kitchen.fireBlanket" label="Fire blanket present" />
                                        <ChecklistItem form={form} name="kitchen.pat" label="PAT-tested appliances (if applicable)" />
                                        <NotesField form={form} name="kitchen.notes" placeholder="Notes on kitchen..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="bathrooms" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Bathrooms</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="bathrooms.toilet" label="Toilet flushing correctly" />
                                        <ChecklistItem form={form} name="bathrooms.shower" label="Shower/bath working" />
                                        <ChecklistItem form={form} name="bathrooms.extractor" label="Extractor fan functioning" />
                                        <ChecklistItem form={form} name="bathrooms.noLeaks" label="No leaks or damp patches" />
                                        <ChecklistItem form={form} name="bathrooms.sealant" label="Sealant and grout intact" />
                                        <ChecklistItem form={form} name="bathrooms.hotWater" label="Adequate hot water supply" />
                                        <NotesField form={form} name="bathrooms.notes" placeholder="Notes on bathrooms..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="utilities" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Heating, Hot Water & Utilities</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="utilities.boiler" label="Boiler functioning and serviced" />
                                        <ChecklistItem form={form} name="utilities.radiators" label="Radiators heating properly" />
                                        <ChecklistItem form={form} name="utilities.thermostats" label="Thermostats working" />
                                        <ChecklistItem form={form} name="utilities.consumerUnit" label="Electrical consumer unit safe and labelled" />
                                        <ChecklistItem form={form} name="utilities.gasCert" label="Gas safety certificate up to date" />
                                        <ChecklistItem form={form} name="utilities.eicr" label="EICR valid" />
                                        <NotesField form={form} name="utilities.notes" placeholder="Notes on utilities..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                             <AccordionItem value="exterior" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Exterior</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="exterior.roof" label="Roof, gutters, and downpipes in good condition" />
                                        <ChecklistItem form={form} name="exterior.pathways" label="Pathways safe and clear" />
                                        <ChecklistItem form={form} name="exterior.garden" label="Garden/yard maintained" />
                                        <ChecklistItem form={form} name="exterior.bins" label="Bins accessible and not overflowing" />
                                        <ChecklistItem form={form} name="exterior.securityLighting" label="Security lighting working" />
                                        <NotesField form={form} name="exterior.notes" placeholder="Notes on exterior..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                             <AccordionItem value="tenant-resp" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Tenant Responsibilities</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="tenantResponsibilities.clean" label="Room kept reasonably clean" />
                                        <ChecklistItem form={form} name="tenantResponsibilities.noSmoking" label="No evidence of smoking indoors" />
                                        <ChecklistItem form={form} name="tenantResponsibilities.noPets" label="No unauthorised pets" />
                                        <ChecklistItem form={form} name="tenantResponsibilities.noTampering" label="No tampering with fire safety equipment" />
                                        <FormField
                                            control={form.control}
                                            name="tenantResponsibilities.concerns"
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-2">
                                                    <FormLabel>Tenant's Concerns Recorded</FormLabel>
                                                    <FormControl>
                                                        <Textarea placeholder="Record any concerns raised by the tenant" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <NotesField form={form} name="tenantResponsibilities.notes" placeholder="General notes on tenant responsibilities..." />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="follow-up" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Follow-Up Actions</AccordionTrigger>
                                <AccordionContent className='pt-4'>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <ChecklistItem form={form} name="followUp.repairsRequired" label="Repairs Required" />
                                        <ChecklistItem form={form} name="followUp.urgentSafetyIssues" label="Urgent Safety Issues" />
                                        <ChecklistItem form={form} name="followUp.maintenanceScheduled" label="Maintenance Scheduled" />
                                        <FormField
                                            control={form.control}
                                            name="followUp.notes"
                                            render={({ field }) => (
                                                <FormItem className="md:col-span-2">
                                                    <FormLabel>Notes for Landlord/Agent</FormLabel>
                                                    <FormControl>
                                                        <Textarea placeholder="Detail any required follow-up actions..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="followUp.nextInspectionDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Next Inspection Date</FormLabel>
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
                                </AccordionContent>
                            </AccordionItem>

                        </Accordion>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" asChild>
                                <Link href="/dashboard/inspections">Cancel</Link>
                            </Button>
                            <Button type="submit">Save Inspection Record</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
