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
import { Upload, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useState, useMemo } from 'react';
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


const inspectionSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }),
  inspectionType: z.string({ required_error: 'Please select an inspection type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  scheduledDate: z.coerce.date({ required_error: 'Please select a scheduled date.' }),
  completedDate: z.coerce.date().optional(),
  inspectorName: z.string().optional(),
  tenantPresentName: z.string().optional(),

  exterior: z.object({
    roofCondition: z.boolean().default(false),
    walls: z.boolean().default(false),
    windowsAndDoors: z.boolean().default(false),
    garden: z.boolean().default(false),
    pathways: z.boolean().default(false),
    bins: z.boolean().default(false),
    notes: z.string().optional()
  }).optional(),
  
  safety: z.object({
      smokeAlarms: z.boolean().default(false),
      coAlarm: z.boolean().default(false),
      electricalSockets: z.boolean().default(false),
      gasCert: z.boolean().default(false),
      eicr: z.boolean().default(false),
      patCert: z.boolean().default(false),
      noTampering: z.boolean().default(false),
      notes: z.string().optional()
  }).optional(),

  interior: z.object({
      wallsCeilingsFloors: z.boolean().default(false),
      noDamp: z.boolean().default(false),
      windows: z.boolean().default(false),
      doors: z.boolean().default(false),
      ventilation: z.boolean().default(false),
      cleanliness: z.boolean().default(false),
      notes: z.string().optional()
  }).optional(),

  kitchen: z.object({
      worktops: z.boolean().default(false),
      sink: z.boolean().default(false),
      oven: z.boolean().default(false),
      fridge: z.boolean().default(false),
      washingMachine: z.boolean().default(false),
      ventilation: z.boolean().default(false),
      notes: z.string().optional()
  }).optional(),
  
  bathrooms: z.object({
      toilet: z.boolean().default(false),
      shower: z.boolean().default(false),
      noLeaks: z.boolean().default(false),
      extractor: z.boolean().default(false),
      sealant: z.boolean().default(false),
      noMould: z.boolean().default(false),
      notes: z.string().optional()
  }).optional(),

  heating: z.object({
      boiler: z.boolean().default(false),
      radiators: z.boolean().default(false),
      thermostat: z.boolean().default(false),
      hotWater: z.boolean().default(false),
      notes: z.string().optional()
  }).optional(),

  bedrooms: z.object({
      windows: z.boolean().default(false),
      heating: z.boolean().default(false),
      noDamp: z.boolean().default(false),
      flooring: z.boolean().default(false),
      furniture: z.boolean().default(false),
      notes: z.string().optional()
  }).optional(),

  tenantResponsibilities: z.object({
      clean: z.boolean().default(false),
      noOccupants: z.boolean().default(false),
      noPets: z.boolean().default(false),
      noSmoking: z.boolean().default(false),
      noAlterations: z.boolean().default(false),
      concerns: z.string().optional(),
      notes: z.string().optional()
  }).optional(),

  followUpActions: z.object({
    repairsRequired: z.boolean().default(false),
    urgentSafetyIssues: z.boolean().default(false),
    maintenanceScheduled: z.boolean().default(false),
    notes: z.string().optional(),
  }).optional(),

  report: z.any().optional(),
});

type InspectionFormValues = z.infer<typeof inspectionSchema>;

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
  status?: string;
}

const ChecklistItem = ({ form, name, label }: { form: any, name: any, label: string }) => {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                     <FormControl>
                        <Checkbox
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                        />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal">{label}</FormLabel>
                    </div>
                </FormItem>
            )}
        />
    )
}

const NotesField = ({ form, name, placeholder }: { form: any, name: any, placeholder: string }) => {
     return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem className="mt-4 col-span-1 md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                        <Textarea placeholder={placeholder} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
     )
}


export default function SingleLetInspectionPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [formDataToSave, setFormDataToSave] = useState<InspectionFormValues | null>(null);

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
        status: 'Completed',
        inspectionType: 'Routine Inspection',
        propertyId: '',
    }
  });

  useEffect(() => {
    form.setValue('scheduledDate', new Date());
  }, [form]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'userProfiles', user.uid, 'properties'),
        where('ownerId', '==', user.uid),
        limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  const properties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status || '')) ?? [];
  }, [allProperties]);

  const prepareForFirestore = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value === undefined) return null;
        if (value && typeof value === 'object' && (value.constructor.name === 'FileList' || value.constructor.name === 'File')) return null;
        return value;
    }));
  };

  async function proceedToSave(data: InspectionFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
      const { propertyId, report, ...inspectionData } = data;
      
      const newInspection = {
        ...inspectionData,
        ownerId: user.uid,
        propertyId: propertyId,
        type: 'Single-Let',
        status: data.status || 'Completed',
      };

      const cleanedSubmission = prepareForFirestore(newInspection);

      const inspectionsCollection = collection(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'inspections');
      await addDoc(inspectionsCollection, cleanedSubmission);
      
      toast({
        title: 'Inspection Saved',
        description: 'The inspection details have been successfully saved.',
      });
      router.push('/dashboard/inspections');
    } catch (error) {
      console.error('Failed to save inspection:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'There was an error saving the inspection. Please check your data and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(data: InspectionFormValues) {
    const checklistSections = ['exterior', 'safety', 'interior', 'kitchen', 'bathrooms', 'heating', 'bedrooms', 'tenantResponsibilities'] as const;
    let totalFields = 0;
    let tickedFields = 0;

    checklistSections.forEach(section => {
        const sectionData = data[section];
        if (sectionData) {
            Object.values(sectionData).forEach(val => {
                if (typeof val === 'boolean') {
                    totalFields++;
                    if (val) tickedFields++;
                }
            });
        }
    });

    const completionRate = totalFields > 0 ? (tickedFields / totalFields) : 1;

    if (completionRate < 0.9) {
        setFormDataToSave(data);
        setIsConfirmDialogOpen(true);
    } else {
        await proceedToSave(data);
    }
  }

  const handleConfirmSave = async () => {
    setIsConfirmDialogOpen(false);
    if (formDataToSave) {
        await proceedToSave(formDataToSave);
    }
    setFormDataToSave(null);
  };

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city].filter(Boolean).join(', ');
  };

  return (
    <>
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Record Single-Let Inspection</CardTitle>
          <CardDescription>
            Fill in the details to record a property inspection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Inspection Details</CardTitle>
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
                              <SelectValue placeholder={isLoadingProperties ? "Loading properties..." : "Select an active property"} />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="inspectionType"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Inspection Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select a type" />
                              </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                              {[
                                  'Routine Inspection', 'Move-in Inspection', 'Move-Out Inspection', 'Gas Safety Check', 'Electrical Safety', 'Legionella Risk', 'Fire Safety'
                              ].map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                      <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select a status" />
                              </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                              {['Scheduled', 'Completed', 'Cancelled'].map((p) => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                          </FormItem>
                      )}
                      />
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <FormField
                          control={form.control}
                          name="scheduledDate"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Scheduled Date</FormLabel>
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
                          name="completedDate"
                          render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Completed Date</FormLabel>
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
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                          control={form.control}
                          name="inspectorName"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Inspector Name</FormLabel>
                              <FormControl>
                                  <Input placeholder="e.g., Jane Smith" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                      <FormField
                          control={form.control}
                          name="tenantPresentName"
                          render={({ field }) => (
                              <FormItem>
                              <FormLabel>Tenant Present Name</FormLabel>
                              <FormControl>
                                  <Input placeholder="e.g., John Doe" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormMessage />
                              </FormItem>
                          )}
                      />
                   </div>
                </CardContent>
              </Card>

              <h2 className="text-xl font-semibold border-b pb-2">Inspection Checklist</h2>

              <Accordion type="multiple" className="w-full space-y-4">
                <AccordionItem value="exterior" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Exterior</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="exterior.roofCondition" label="Roof condition" />
                          <ChecklistItem form={form} name="exterior.walls" label="Walls, brickwork" />
                          <ChecklistItem form={form} name="exterior.windowsAndDoors" label="Windows and external doors secure/undamaged" />
                          <ChecklistItem form={form} name="exterior.garden" label="Garden maintained" />
                          <ChecklistItem form={form} name="exterior.pathways" label="Pathways safe and clear" />
                          <ChecklistItem form={form} name="exterior.bins" label="Bins accessible and not overflowing" />
                          <NotesField form={form} name="exterior.notes" placeholder="Notes on exterior..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="safety" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Safety & Compliance</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="safety.smokeAlarms" label="Smoke alarms tested and working" />
                          <ChecklistItem form={form} name="safety.coAlarm" label="Carbon monoxide alarm present and working" />
                          <ChecklistItem form={form} name="safety.electricalSockets" label="Electrical sockets and switches safe" />
                          <ChecklistItem form={form} name="safety.gasCert" label="Gas safety certificate valid" />
                          <ChecklistItem form={form} name="safety.eicr" label="EICR valid" />
                          <ChecklistItem form={form} name="safety.patCert" label="PAT Certificate if portable appliances supplied" />
                          <ChecklistItem form={form} name="safety.noTampering" label="No signs of tampering with safety equipment" />
                          <NotesField form={form} name="safety.notes" placeholder="Notes on safety..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="interior" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Interior General Condition</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="interior.wallsCeilorsFloors" label="Walls, ceilings, floors" />
                          <ChecklistItem form={form} name="interior.noDamp" label="No signs of damp, mould, or condensation" />
                          <ChecklistItem form={form} name="interior.windows" label="Windows open and close correctly" />
                          <ChecklistItem form={form} name="interior.doors" label="Internal doors and locks functioning" />
                          <ChecklistItem form={form} name="interior.ventilation" label="Adequate ventilation throughout" />
                          <ChecklistItem form={form} name="interior.cleanliness" label="Cleanliness and general upkeep acceptable" />
                          <NotesField form={form} name="interior.notes" placeholder="Notes on interior..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>
                
                 <AccordionItem value="kitchen" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Kitchen</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="kitchen.worktops" label="Worktops, cupboards and flooring" />
                          <ChecklistItem form={form} name="kitchen.sink" label="Sink and taps working" />
                          <ChecklistItem form={form} name="kitchen.oven" label="Oven and hob, extractor functioning" />
                          <ChecklistItem form={form} name="kitchen.fridge" label="Fridge freezer working" />
                          <ChecklistItem form={form} name="kitchen.washingMachine" label="Washing machine working (if supplied)" />
                          <ChecklistItem form={form} name="kitchen.ventilation" label="Adequate ventilation" />
                          <NotesField form={form} name="kitchen.notes" placeholder="Notes on kitchen..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="bathrooms" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Bathrooms</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="bathrooms.toilet" label="Toilet flushing" />
                          <ChecklistItem form={form} name="bathrooms.shower" label="Shower/bath working" />
                          <ChecklistItem form={form} name="bathrooms.noLeaks" label="No leaks from taps, pipes, seals" />
                          <ChecklistItem form={form} name="bathrooms.extractor" label="Extractor fan working" />
                          <ChecklistItem form={form} name="bathrooms.sealant" label="Sealant and grout intact" />
                          <ChecklistItem form={form} name="bathrooms.noMould" label="No mould or damp" />
                          <NotesField form={form} name="bathrooms.notes" placeholder="Notes on bathrooms..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="heating" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Heating</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="heating.boiler" label="Boiler functioning" />
                          <ChecklistItem form={form} name="heating.radiators" label="Radiators heating properly" />
                          <ChecklistItem form={form} name="heating.thermostat" label="Thermostat working" />
                          <ChecklistItem form={form} name="heating.hotWater" label="Hot water supply consistent" />
                          <NotesField form={form} name="heating.notes" placeholder="Notes on heating..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="bedrooms" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Bedrooms</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="bedrooms.windows" label="Windows and locks working" />
                          <ChecklistItem form={form} name="bedrooms.heating" label="Heating operational" />
                          <ChecklistItem form={form} name="bedrooms.noDamp" label="No damp or mould" />
                          <ChecklistItem form={form} name="bedrooms.flooring" label="Flooring and walls in good condition" />
                          <ChecklistItem form={form} name="bedrooms.furniture" label="Furniture safe and undamaged (if provided)" />
                          <NotesField form={form} name="bedrooms.notes" placeholder="Notes on bedrooms..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="tenant" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Tenant Responsibilities</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="tenantResponsibilities.clean" label="Property kept reasonably clean" />
                          <ChecklistItem form={form} name="tenantResponsibilities.noOccupants" label="No unauthorised occupants" />
                          <ChecklistItem form={form} name="tenantResponsibilities.noPets" label="No unauthorised pets" />
                          <ChecklistItem form={form} name="tenantResponsibilities.noSmoking" label="No evidence of smoking indoors" />
                          <ChecklistItem form={form} name="tenantResponsibilities.noAlterations" label="No alterations without permission" />
                          <FormField
                              control={form.control}
                              name="tenantResponsibilities.concerns"
                              render={({ field }) => (
                                  <FormItem className="md:col-span-2">
                                      <FormLabel>Tenant's Concerns Recorded</FormLabel>
                                      <FormControl>
                                          <Textarea placeholder="Record any concerns raised by the tenant" {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <NotesField form={form} name="tenantResponsibilities.notes" placeholder="General notes on tenant responsibilities..." />
                      </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="followUp" className='border rounded-lg px-4'>
                  <AccordionTrigger suppressHydrationWarning className='text-lg font-semibold'>Follow-up Actions</AccordionTrigger>
                  <AccordionContent className='pt-4'>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ChecklistItem form={form} name="followUpActions.repairsRequired" label="Repairs Required" />
                          <ChecklistItem form={form} name="followUpActions.urgentSafetyIssues" label="Urgent Safety Issues" />
                          <ChecklistItem form={form} name="followUpActions.maintenanceScheduled" label="Maintenance Scheduled" />
                          <FormField
                              control={form.control}
                              name="followUpActions.notes"
                              render={({ field }) => (
                                  <FormItem className="md:col-span-2">
                                      <FormLabel>Notes for Landlord/Agent</FormLabel>
                                      <FormControl>
                                          <Textarea placeholder="Detail any required follow-up actions..." {...field} value={field.value ?? ''} />
                                      </FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                      </div>
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
              
              <Card>
                  <CardHeader>
                  <CardTitle className="text-xl">Upload Report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                  <FormField
                      control={form.control}
                      name="report"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Upload File (Optional)</FormLabel>
                          <FormControl>
                          <Button asChild variant="outline" className="w-full">
                              <label className="cursor-pointer">
                                  <Upload className="mr-2 h-4 w-4" />
                                  Choose File
                                  <Input type="file" className="sr-only" onChange={(e) => field.onChange(e.target.files)} />
                              </label>
                          </Button>
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" asChild>
                  <Link href="/dashboard/inspections">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : 'Save Inspection'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incomplete Checklist</AlertDialogTitle>
            <AlertDialogDescription>
              A significant number of checklist items have not been ticked. Are you sure you want to save this report as it is?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFormDataToSave(null)}>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Anyway'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}