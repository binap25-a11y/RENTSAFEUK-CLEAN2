'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useFirebase } from '@/firebase';
import { collection, addDoc, doc, setDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { uploadPropertyImage } from '@/lib/upload-image';
import { 
  Loader2, 
  ShieldAlert, 
  MapPin, 
  Home, 
  Building, 
  Building2, 
  Hotel, 
  Warehouse, 
  Bed, 
  Bath, 
  PoundSterling, 
  Info, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  CheckCircle2,
  AlertCircle,
  X,
  Images,
  PlusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;

const propertySchema = z.object({
  address: z.object({
    nameOrNumber: z.string().trim().optional(),
    street: z.string().trim().min(3, 'Please enter a valid street address.'),
    city: z.string().trim().min(2, 'Please enter a valid city or town.'),
    county: z.string().trim().min(2, 'Please enter a county.'),
    postcode: z.string().trim().regex(ukPostcodeRegex, 'Please enter a valid UK postcode (e.g. SW1A 1AA).'),
  }),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  bedrooms: z.coerce.number().min(0, 'Bedrooms cannot be negative'),
  bathrooms: z.coerce.number().min(0, 'Bathrooms cannot be negative'),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  additionalImageUrls: z.array(z.string()).optional(),
  purchasePrice: z.coerce.number().min(0, 'Price cannot be negative').optional(),
  currentValuation: z.coerce.number().min(0, 'Valuation cannot be negative').optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().min(0, 'Rent cannot be negative').optional(),
    depositAmount: z.coerce.number().min(0, 'Deposit cannot be negative').optional(),
    depositScheme: z.string().optional(),
  }).optional(),
}).refine(data => {
    if (data.tenancy?.depositAmount && data.tenancy.depositAmount > 0) {
        return !!data.tenancy.depositScheme?.trim();
    }
    return true;
}, {
  message: "Deposit scheme is required if a deposit amount is entered.",
  path: ["tenancy", "depositScheme"]
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const propertyTypes = [
  { value: 'House', icon: Home, label: 'House' },
  { value: 'Flat', icon: Building, label: 'Flat / Apt' },
  { value: 'HMO', icon: Hotel, label: 'HMO' },
  { value: 'Bungalow', icon: Home, label: 'Bungalow' },
  { value: 'Maisonette', icon: Building2, label: 'Maisonette' },
  { value: 'Studio', icon: Warehouse, label: 'Studio' },
];

export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const { firestore } = useFirebase();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      bedrooms: 0,
      bathrooms: 0,
      status: 'Vacant',
      propertyType: 'House',
      address: { nameOrNumber: '', street: '', city: '', county: '', postcode: '' },
      notes: '',
      tenancy: { monthlyRent: undefined, depositAmount: undefined, depositScheme: '' },
    },
  });

  // Watch individual sub-fields for map verification reactivity
  const street = form.watch('address.street');
  const city = form.watch('address.city');
  const county = form.watch('address.county');
  const postcode = form.watch('address.postcode');
  
  const mapUrl = useMemo(() => {
    const parts = [street, city, county, postcode].filter(p => !!p && p.trim().length > 0);
    if (parts.length === 0) return null;
    const query = parts.join(', ');
    return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  }, [street, city, county, postcode]);

  const progress = (step / 4) * 100;

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setMainPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setGalleryFiles(prev => [...prev, ...files]);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setGalleryPreviews(prev => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
  };

  const removeMainFile = () => {
    setMainFile(null);
    setMainPreview(null);
    if (mainInputRef.current) mainInputRef.current.value = '';
  };

  const removeGalleryFile = (index: number) => {
    setGalleryFiles(prev => prev.filter((_, i) => i !== index));
    setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
  };

  async function onSubmit(data: PropertyFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
        const propertiesCollection = collection(firestore, 'userProfiles', user.uid, 'properties');
        
        const duplicateQuery = query(
            propertiesCollection,
            where('address.street', '==', data.address.street),
            where('address.postcode', '==', data.address.postcode),
            where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
            limit(1)
        );
        const duplicateSnap = await getDocs(duplicateQuery);

        if (!duplicateSnap.empty) {
            toast({
                variant: 'destructive',
                title: 'Duplicate Property',
                description: 'A property with this street and postcode already exists in your active portfolio.',
            });
            setIsSubmitting(false);
            return;
        }

        const docRef = await addDoc(propertiesCollection, {
            ownerId: user.uid,
            ...JSON.parse(JSON.stringify(data)),
            createdDate: new Date().toISOString(),
        });

        const propertyId = docRef.id;
        let imageUrl = '';
        const additionalImageUrls: string[] = [];

        if (mainFile) {
          imageUrl = await uploadPropertyImage(mainFile, user.uid, propertyId);
        }

        if (galleryFiles.length > 0) {
          const uploadPromises = galleryFiles.map(file =>
              uploadPropertyImage(file, user.uid, propertyId)
          );
          const urls = await Promise.all(uploadPromises);
          additionalImageUrls.push(...urls);
        }
        
        await setDoc(docRef, { imageUrl, additionalImageUrls }, { merge: true });
        
        toast({ title: 'Property Onboarded' });
        router.push('/dashboard/properties');
    } catch (serverError: any) {
        console.error("Save failed:", serverError);
        toast({ variant: 'destructive', title: 'Save Failed', description: serverError.message || 'An unexpected error occurred.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['address.nameOrNumber', 'address.street', 'address.city', 'address.county', 'address.postcode'];
    if (step === 2) fieldsToValidate = ['propertyType', 'bedrooms', 'bathrooms', 'status'];
    if (step === 3) fieldsToValidate = ['purchasePrice', 'currentValuation', 'tenancy.monthlyRent', 'tenancy.depositAmount', 'tenancy.depositScheme'];

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Onboard New Property</h1>
        <p className="text-muted-foreground font-medium">Complete the secure data capture process for your portfolio property.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {step}
                </div>
                <span className="font-bold text-sm uppercase tracking-widest text-primary">
                  {step === 1 && "Location & Identity"}
                  {step === 2 && "Property Specification"}
                  {step === 3 && "Investment & Tenancy"}
                  {step === 4 && "Media & Final Audit"}
                </span>
              </div>
              <span className="text-xs font-bold text-muted-foreground">{step} of 4</span>
            </div>
            <Progress value={progress} className="h-1 rounded-none bg-muted" />
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">
                
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-4">
                        <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Building Name/No</FormLabel>
                            <FormControl><Input placeholder="e.g. Flat 1 or 12" className="h-11" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="address.street" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Street Address</FormLabel>
                            <FormControl><Input placeholder="e.g. High Street" className="h-11" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="address.city" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold">City/Town</FormLabel>
                              <FormControl><Input placeholder="London" className="h-11" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="address.county" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold">County</FormLabel>
                              <FormControl><Input placeholder="e.g. Essex" className="h-11" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name="address.postcode" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Post Code</FormLabel>
                            <FormControl><Input placeholder="W1A 1AA" className="h-11 uppercase" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="space-y-2">
                        <FormLabel className="font-bold flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          Live Map Verification
                        </FormLabel>
                        <div className="aspect-square w-full rounded-xl overflow-hidden border-2 border-muted bg-muted shadow-inner relative">
                          {mapUrl ? (
                            <iframe 
                                key={mapUrl} // key ensures iframe reloads on URL change
                                width="100%" 
                                height="100%" 
                                style={{ border: 0 }} 
                                title="Property Map" 
                                loading="lazy" 
                                src={mapUrl}
                            ></iframe>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-muted-foreground/40">
                              <MapPin className="h-12 w-12 mb-2" />
                              <p className="text-xs font-bold uppercase tracking-widest text-center">Awaiting address...</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      <FormLabel className="font-bold text-lg">Property Architecture Type</FormLabel>
                      <FormField
                        control={form.control}
                        name="propertyType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="grid grid-cols-2 md:grid-cols-3 gap-4"
                              >
                                {propertyTypes.map((type) => (
                                  <FormItem key={type.value}>
                                    <FormControl>
                                      <RadioGroupItem value={type.value} className="sr-only" />
                                    </FormControl>
                                    <FormLabel className={cn(
                                      "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50",
                                      field.value === type.value ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "border-muted"
                                    )}>
                                      <type.icon className={cn("h-8 w-8", field.value === type.value ? "text-primary" : "text-muted-foreground")} />
                                      <span className={cn("text-xs font-bold uppercase tracking-wider", field.value === type.value ? "text-primary" : "text-muted-foreground")}>
                                        {type.label}
                                      </span>
                                    </FormLabel>
                                  </FormItem>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField control={form.control} name="bedrooms" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold flex items-center gap-2"><Bed className="h-4 w-4" /> Bedrooms</FormLabel>
                          <FormControl><Input type="number" min="0" className="h-11" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="bathrooms" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold flex items-center gap-2"><Bath className="h-4 w-4" /> Bathrooms</FormLabel>
                          <FormControl><Input type="number" min="0" className="h-11" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Portfolio Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {['Vacant', 'Occupied', 'Under Maintenance'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <PoundSterling className="h-5 w-5 text-primary" />
                          Acquisition Data
                        </h3>
                        <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Purchase Price (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} value={field.value ?? ''} /></FormControl>
                            <FormDescription>Original cost for ROI tracking.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="currentValuation" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Current Market Value (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="space-y-6">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-green-600">
                          <ShieldAlert className="h-5 w-5" />
                          Rental & Protection
                        </h3>
                        <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Gross Monthly Rent (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Security Deposit (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {form.watch('tenancy.depositAmount') > 0 && (
                          <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (
                            <FormItem className="animate-in slide-in-from-top-2 duration-200">
                              <FormLabel className="font-bold text-destructive">Compliance: Protection Scheme</FormLabel>
                              <FormControl><Input placeholder="e.g. DPS, TDS, MyDeposits" className="h-11 border-destructive/20 focus:border-destructive" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Home className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-lg">Main Identity Photo</h3>
                      </div>
                      
                      {mainPreview ? (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border shadow-inner group">
                          <Image src={mainPreview} alt="Main Preview" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <Button type="button" variant="secondary" size="sm" onClick={() => mainInputRef.current?.click()}>
                              <Upload className="mr-2 h-4 w-4" /> Change Main Photo
                            </Button>
                            <Button type="button" variant="destructive" size="sm" onClick={removeMainFile}>
                              <X className="mr-2 h-4 w-4" /> Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="border-2 border-dashed border-muted-foreground/20 rounded-2xl p-12 text-center flex flex-col items-center gap-4 bg-muted/5 group hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => mainInputRef.current?.click()}
                        >
                          <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                          <p className="font-bold text-sm">Assign Main Portfolio Photo</p>
                        </div>
                      )}
                      <input type="file" ref={mainInputRef} onChange={handleMainFileChange} accept="image/*" className="hidden" />
                    </div>

                    <div className="space-y-6 pt-6 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Images className="h-5 w-5 text-primary" />
                        <h3 className="font-bold text-lg">Property Gallery</h3>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {galleryPreviews.map((preview, idx) => (
                          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group">
                            <Image src={preview} alt={`Gallery ${idx}`} fill className="object-cover" />
                            <button type="button" onClick={() => removeGalleryFile(idx)} className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                        <div className="border-2 border-dashed border-muted-foreground/20 rounded-xl flex flex-col items-center justify-center gap-2 bg-muted/5 cursor-pointer hover:border-primary/50 aspect-square" onClick={() => galleryInputRef.current?.click()}>
                          <PlusCircle className="h-6 w-6 text-muted-foreground" />
                          <span className="text-[10px] font-bold uppercase text-muted-foreground">Add Photos</span>
                        </div>
                      </div>
                      <input type="file" ref={galleryInputRef} onChange={handleGalleryFilesChange} accept="image/*" multiple className="hidden" />
                    </div>

                    <div className="space-y-4 pt-6 border-t">
                      <FormField control={form.control} name="notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Confidential Management Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Observations, history, or specific requirements..." className="resize-none min-h-[120px] rounded-xl" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-8 border-t">
                  <Button type="button" variant="ghost" onClick={step === 1 ? () => router.back() : prevStep} className="font-bold uppercase tracking-widest text-xs h-11"><ChevronLeft className="mr-2 h-4 w-4" />{step === 1 ? "Cancel" : "Back"}</Button>
                  {step < 4 ? (
                    <Button type="button" onClick={nextStep} className="font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-md">Continue<ChevronRight className="ml-2 h-4 w-4" /></Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting} className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg bg-primary hover:bg-primary/90">{isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : "Finalize Property Capture"}</Button>
                  )}
                </div>
              </form>
            </Form>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-md bg-muted/20">
            <CardHeader className="pb-4"><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4 text-primary" />Portfolio Guidance</CardTitle></CardHeader>
            <CardContent className="space-y-6 text-xs text-muted-foreground leading-relaxed">
              <p><strong className="text-primary uppercase tracking-tighter">1. Accurate Geo-Location:</strong> Correct address capture ensures local authority compliance alerts function with maximum precision.</p>
              <p><strong className="text-primary uppercase tracking-tighter">2. Digital Audit Trail:</strong> Adding gallery photos helps document condition at move-in, supporting future deposit recovery audits.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
