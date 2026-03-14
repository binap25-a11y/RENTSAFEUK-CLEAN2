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
import { Loader2, CheckCircle2, Download, X, Upload, Images, FileVideo } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useState, useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, addDoc, limit, doc, updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { generateInspectionPDF } from '@/lib/generate-inspection-pdf';
import { uploadPropertyDocument } from '@/lib/upload-document';
import { uploadPropertyImage } from '@/lib/upload-image';
import { format } from 'date-fns';
import Image from 'next/image';

const hmoInspectionSchema = z.object({
  // General
  inspectionDate: z.coerce.date(),
  inspectorName: z.string().min(1, "Inspector name is required"),
  propertyId: z.string({ required_error: 'Please select a property.' }),
  occupantCount: z.coerce.number().min(1, "Occupant count must be at least 1"),
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
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
  status?: string;
}

const ChecklistItem = ({ form, name, label }: { form: any, name: any, label: string }) => (
    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-muted/50 transition-colors">
                <FormControl>
                    <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel className="font-normal cursor-pointer">{label}</FormLabel>
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
                <FormLabel>Section Notes</FormLabel>
                <FormControl>
                    <Textarea placeholder={placeholder} {...field} value={field.value ?? ''} />
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [videoFiles, setVideoFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);

    const form = useForm<HmoInspectionFormValues>({
        resolver: zodResolver(hmoInspectionSchema),
        defaultValues: {
            inspectorName: '',
            propertyId: '',
            occupantCount: 1,
        }
    });

    const watchAllFields = form.watch();

    const getSectionStatus = (sectionKey: keyof HmoInspectionFormValues) => {
        const section = watchAllFields[sectionKey];
        if (!section || typeof section !== 'object') return null;
        
        const booleanFields = Object.values(section).filter(v => typeof v === 'boolean');
        if (booleanFields.length === 0) return null;
        
        const completedCount = booleanFields.filter(Boolean).length;
        if (completedCount === 0) return null;
        if (completedCount === booleanFields.length) return 'Completed';
        return 'In Progress';
    };

    const StatusBadge = ({ status }: { status: string | null }) => {
        if (!status) return null;
        return (
            <Badge variant={status === 'Completed' ? 'default' : 'secondary'} className="ml-2 gap-1">
                {status === 'Completed' && <CheckCircle2 className="h-3 w-3" />}
                {status}
            </Badge>
        );
    };

    useEffect(() => {
        form.setValue('inspectionDate', new Date());
    }, [form]);

    const propertiesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'properties'),
            where('landlordId', '==', user.uid),
            limit(500)
        );
    }, [firestore, user]);
    const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

    const activeProperties = useMemo(() => {
        const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
        return allProperties?.filter(p => activeStatuses.includes(p.status || '')) ?? [];
    }, [allProperties]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
      const files = Array.from(e.target.files || []);
      if (type === 'photo') {
        setPhotoFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(f => URL.createObjectURL(f));
        setPreviews(prev => [...prev, ...newPreviews]);
      } else {
        setVideoFiles(prev => [...prev, ...files]);
      }
    };

    const removeFile = (idx: number, type: 'photo' | 'video') => {
      if (type === 'photo') {
        const updatedFiles = [...photoFiles];
        updatedFiles.splice(idx, 1);
        setPhotoFiles(updatedFiles);
        
        const updatedPreviews = [...previews];
        URL.revokeObjectURL(updatedPreviews[idx]);
        updatedPreviews.splice(idx, 1);
        setPreviews(updatedPreviews);
      } else {
        const updatedFiles = [...videoFiles];
        updatedFiles.splice(idx, 1);
        setVideoFiles(updatedFiles);
      }
    };

    const prepareForFirestore = (obj: any): any => {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
            if (value === undefined) return null;
            return value;
        }));
    };

    async function onSubmit(data: HmoInspectionFormValues) {
        if (!user || !firestore) return;
        setIsSubmitting(true);

        const { propertyId, ...inspectionData } = data;
        const selectedProperty = activeProperties.find(p => p.id === propertyId);

        try {
            // Upload media
            const photoUrls = await Promise.all(photoFiles.map(f => uploadPropertyImage(f, user.uid, propertyId)));
            const videoUrls = await Promise.all(videoFiles.map(f => uploadPropertyDocument(f, user.uid, propertyId)));

            const newInspection = {
                ...inspectionData,
                landlordId: user.uid,
                propertyId: propertyId,
                scheduledDate: data.inspectionDate,
                type: 'HMO',
                status: 'Completed',
                photoUrls: photoUrls.filter(Boolean),
                videoUrls: videoUrls.filter(Boolean),
            };

            const cleanedSubmission = prepareForFirestore(newInspection);
            const inspectionsCollection = collection(firestore, 'inspections');
            const docRef = await addDoc(inspectionsCollection, cleanedSubmission);
            
            // AUTO-PDF GENERATION WORKFLOW
            toast({ title: 'HMO Report Saved', description: 'Generating PDF audit record...' });
            const pdfDoc = await generateInspectionPDF(newInspection, selectedProperty);
            
            // AUTO-UPLOAD TO RESIDENT HUB
            if (selectedProperty && pdfDoc) {
                try {
                    const blob = pdfDoc.output('blob');
                    const fileName = `HMO-Inspection-${format(new Date(), 'yyyyMMdd')}-${propertyId.substring(0,5)}.pdf`;
                    const file = new File([blob], fileName, { type: 'application/pdf' });
                    const fileUrl = await uploadPropertyDocument(file, user.uid, propertyId);
                    
                    await addDoc(collection(firestore, 'documents'), {
                        title: `HMO Inspection Report (${format(new Date(), 'dd/MM/yyyy')})`,
                        propertyId: propertyId,
                        landlordId: user.uid,
                        documentType: 'Inspection Report',
                        issueDate: new Date().toISOString(),
                        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        fileUrl,
                        isAutoGenerated: true,
                        inspectionId: docRef.id
                    });
                    toast({ title: 'Shared with Resident', description: 'Report uploaded to Resident Hub.' });
                } catch (uploadErr) {
                    console.error("Auto-upload failure:", uploadErr);
                    toast({ variant: 'destructive', title: 'Vault Sync Failed', description: 'Report saved but could not be shared automatically.' });
                }
            }

            router.push(`/dashboard/inspections/${docRef.id}?propertyId=${propertyId}`);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Check your internet connection and try again.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const formatAddress = (address: Property['address']) => {
        return [address.nameOrNumber, address.street, address.city].filter(Boolean).join(', ');
    };

    return (
        <Card className="max-w-4xl mx-auto text-left">
            <CardHeader>
                <CardTitle>HMO Inspection Checklist</CardTitle>
                <CardDescription>
                    Record a detailed inspection for an HMO and generate an audit PDF with visual evidence.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Accordion type="multiple" className="w-full space-y-4" defaultValue={['general']}>
                            <AccordionItem value="general" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>General Information</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-4'>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="inspectionDate"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Inspection Date</FormLabel>
                                                    <FormControl><Input type="date" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl>
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
                                                    <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
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
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder={isLoadingProperties ? "Loading..." : "Select property"} /></SelectTrigger></FormControl>
                                                    <SelectContent>{activeProperties?.map((prop) => (<SelectItem key={prop.id} value={prop.id}>{formatAddress(prop.address)}</SelectItem>))}</SelectContent>
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
                                                    <FormLabel>No. of Occupants</FormLabel>
                                                    <FormControl><Input type="number" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="fire-safety" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Fire Safety <StatusBadge status={getSectionStatus('fireSafety')} /></AccordionTrigger>
                                <AccordionContent className='pt-4 grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <ChecklistItem form={form} name="fireSafety.interlinkedAlarms" label="Interlinked alarms working" />
                                    <ChecklistItem form={form} name="fireSafety.heatDetector" label="Heat detector in kitchen" />
                                    <ChecklistItem form={form} name="fireSafety.fireDoors" label="Fire doors self-closing" />
                                    <ChecklistItem form={form} name="fireSafety.doorSeals" label="Intumescent seals intact" />
                                    <ChecklistItem form={form} name="fireSafety.extinguishers" label="Fire extinguishers serviced" />
                                    <ChecklistItem form={form} name="fireSafety.fireBlanket" label="Fire blanket in kitchen" />
                                    <ChecklistItem form={form} name="fireSafety.emergencyLighting" label="Emergency lighting operational" />
                                    <ChecklistItem form={form} name="fireSafety.clearRoutes" label="Fire escape routes clear" />
                                    <NotesField form={form} name="fireSafety.notes" placeholder="Fire safety notes..." />
                                </AccordionContent>
                            </AccordionItem>

                             <AccordionItem value="communal" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Communal Areas <StatusBadge status={getSectionStatus('communal')} /></AccordionTrigger>
                                <AccordionContent className='pt-4 grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <ChecklistItem form={form} name="communal.clean" label="Clean and hazard-free" />
                                    <ChecklistItem form={form} name="communal.lighting" label="Adequate lighting" />
                                    <ChecklistItem form={form} name="communal.flooring" label="Safe flooring" />
                                    <ChecklistItem form={form} name="communal.wasteDisposal" label="Waste area tidy" />
                                    <NotesField form={form} name="communal.notes" placeholder="Communal notes..." />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="tenant-resp" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Tenant Responsibilities <StatusBadge status={getSectionStatus('tenantResponsibilities')} /></AccordionTrigger>
                                <AccordionContent className='pt-4 grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <ChecklistItem form={form} name="tenantResponsibilities.clean" label="Room kept clean" />
                                    <ChecklistItem form={form} name="tenantResponsibilities.noSmoking" label="No evidence of smoking" />
                                    <ChecklistItem form={form} name="tenantResponsibilities.noTampering" label="No tampering with fire equipment" />
                                    <NotesField form={form} name="tenantResponsibilities.notes" placeholder="Tenant behavior notes..." />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="media" className='border rounded-lg px-4'>
                                <AccordionTrigger className='text-lg font-semibold'>Media Evidence Vault</AccordionTrigger>
                                <AccordionContent className='pt-4 space-y-6'>
                                    <div className="space-y-4">
                                        <FormLabel className="font-bold flex items-center gap-2"><Images className="h-4 w-4 text-primary" /> Photos (Included in PDF)</FormLabel>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {previews.map((url, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm bg-background">
                                                    <Image src={url} alt="Preview" fill className="object-cover" unoptimized />
                                                    <Button type="button" variant="destructive" size="icon" className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" onClick={() => removeFile(idx, 'photo')}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                            <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 bg-muted/5 cursor-pointer aspect-square hover:bg-muted/10 transition-colors" onClick={() => document.getElementById('hmo-photo-upload')?.click()}>
                                                <Upload className="h-6 w-6 text-muted-foreground" />
                                                <span className="text-[10px] font-bold uppercase">Add Photo</span>
                                            </div>
                                        </div>
                                        <input id="hmo-photo-upload" type="file" multiple className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'photo')} />
                                    </div>

                                    <div className="space-y-4 border-t pt-6">
                                        <FormLabel className="font-bold flex items-center gap-2"><FileVideo className="h-4 w-4 text-primary" /> Videos (Hub Access Only)</FormLabel>
                                        <div className="space-y-2">
                                            {videoFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-muted/30">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <FileVideo className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-xs font-medium truncate">{file.name}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFile(idx, 'video')}><X className="h-4 w-4" /></Button>
                                                </div>
                                            ))}
                                            <Button type="button" variant="outline" className="w-full border-dashed h-11 font-bold uppercase tracking-widest text-[10px]" onClick={() => document.getElementById('hmo-video-upload')?.click()}>
                                                <Upload className="mr-2 h-4 w-4" /> Upload Video Evidence
                                            </Button>
                                        </div>
                                        <input id="hmo-video-upload" type="file" multiple className="hidden" accept="video/*" onChange={(e) => handleFileChange(e, 'video')} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" asChild><Link href="/dashboard/inspections">Cancel</Link></Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                ) : (
                                  <><Download className="mr-2 h-4 w-4" /> Save & Export PDF</>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
