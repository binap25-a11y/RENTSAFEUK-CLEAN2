'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
<<<<<<< HEAD
import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { uploadPropertyImage } from '@/lib/upload-image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import { Loader2, Home, Images, PlusCircle, X, Upload, MapPin, ChevronRight, ChevronLeft, Banknote } from 'lucide-react';
import { Label } from '@/components/ui/label';
=======
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
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310

const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;

const propertySchema = z.object({
  address: z.object({
    nameOrNumber: z.string().trim().optional(),
<<<<<<< HEAD
    street: z.string().trim().min(3, "Please enter street name"),
    city: z.string().trim().min(2, "Please enter city"),
    county: z.string().trim().min(2, "Please enter county"),
    postcode: z.string().trim().regex(ukPostcodeRegex, "Enter valid UK postcode"),
  }),
  propertyType: z.string().min(1, "Select property type"),
  status: z.string().min(1, "Select status"),
  bedrooms: z.coerce.number().min(0),
  bathrooms: z.coerce.number().min(0),
  notes: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  currentValuation: z.coerce.number().min(0).optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().min(0).optional(),
    depositAmount: z.coerce.number().min(0).optional(),
    depositScheme: z.string().optional(),
  }).optional(),
=======
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
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
});

type PropertyFormValues = z.infer<typeof propertySchema>;

<<<<<<< HEAD
export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

=======
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
  
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
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
<<<<<<< HEAD
      tenancy: {
          monthlyRent: undefined,
          depositAmount: undefined,
          depositScheme: 'DPS'
      }
    },
  });

  const { street, city, county, postcode } = form.watch('address');
  const mapUrl = useMemo(() => {
    const parts = [street, city, county, postcode].filter(Boolean);
    if (!parts.length) return null;
    return `https://maps.google.com/maps?q=${encodeURIComponent(parts.join(', '))}&output=embed`;
  }, [street, city, county, postcode]);

=======
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

>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainFile(file);
<<<<<<< HEAD
      if (mainPreview && mainPreview.startsWith('blob:')) URL.revokeObjectURL(mainPreview);
      setMainPreview(URL.createObjectURL(file));
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setGalleryFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setGalleryPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeGalleryImage = (index: number) => {
      setGalleryFiles(prev => prev.filter((_, i) => i !== index));
      if (galleryPreviews[index].startsWith('blob:')) URL.revokeObjectURL(galleryPreviews[index]);
      setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: PropertyFormValues) => {
=======
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
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
<<<<<<< HEAD
      const propertyCollection = collection(firestore, 'userProfiles', user.uid, 'properties');
      const docRef = await addDoc(propertyCollection, {
        ...JSON.parse(JSON.stringify(data)),
        ownerId: user.uid,
        createdDate: new Date().toISOString(),
        imageUrl: '',
        additionalImageUrls: [],
      });

      let finalIdentityUrl = '';
      if (mainFile) {
          finalIdentityUrl = await uploadPropertyImage(mainFile, user.uid, docRef.id);
      }

      let galleryUrls: string[] = [];
      if (galleryFiles.length > 0) {
          const uploads = await Promise.all(galleryFiles.map(f => uploadPropertyImage(f, user.uid, docRef.id)));
          galleryUrls = uploads.filter((u): u is string => !!u);
      }

      const finalGallery = [...galleryUrls];
      if (finalIdentityUrl && !finalGallery.includes(finalIdentityUrl)) {
        finalGallery.unshift(finalIdentityUrl);
      }

      const updateData = { imageUrl: finalIdentityUrl, additionalImageUrls: finalGallery };
      
      updateDoc(docRef, updateData)
        .then(() => {
            toast({ title: 'Property Onboarded', description: 'Asset record and Photo Gallery synchronized successfully.' });
            router.push('/dashboard/properties');
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Onboarding Failed', description: 'Could not complete the asset sync.' });
        })
        .finally(() => setIsSubmitting(false));

    } catch (err: any) {
      console.error('Onboarding error:', err);
      toast({ variant: 'destructive', title: 'Onboarding Failed', description: err.message || 'Check your connection.' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-headline text-primary">Onboard Property</h1>
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Step {step} of 4</span>
        </div>
        <Progress value={(step / 4) * 100} className="h-2" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {step === 1 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2 font-headline"><MapPin className="h-5 w-5" /> Location Profile</CardTitle>
                <CardDescription>Enter the address to verify geographic placement.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (
                    <FormItem><FormLabel>Building Name/No</FormLabel><FormControl><Input id="prop-no" name="nameOrNumber" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address.street" render={({ field }) => (
                    <FormItem><FormLabel>Street Address</FormLabel><FormControl><Input id="prop-street" name="street" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="address.city" render={({ field }) => (
                      <FormItem><FormLabel>City</FormLabel><FormControl><Input id="prop-city" name="city" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="address.postcode" render={({ field }) => (
                      <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input id="prop-postcode" name="postcode" className="uppercase h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>
                <div className="aspect-square rounded-2xl overflow-hidden border-2 bg-muted relative">
                  {mapUrl ? <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} title="Map Preview" /> : <div className="flex items-center justify-center h-full"><MapPin className="h-12 w-12 text-muted-foreground/40" /></div>}
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t pt-6"><Button type="button" className="h-11 px-8 font-bold" onClick={() => setStep(2)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button></CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2 font-headline"><Home className="h-5 w-5" /> Property Characteristics</CardTitle>
                <CardDescription>Define the physical capacity of the rental unit.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="propertyType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Asset Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger id="prop-type" name="propertyType" className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {['House', 'Flat', 'HMO', 'Bungalow', 'Studio'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Portfolio Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger id="prop-status" name="status" className="h-11"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {['Vacant', 'Occupied', 'Under Maintenance'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <FormField control={form.control} name="bedrooms" render={({ field }) => (
                        <FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input id="prop-beds" name="bedrooms" type="number" min="0" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="bathrooms" render={({ field }) => (
                        <FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input id="prop-baths" name="bathrooms" type="number" min="0" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t pt-6">
                  <Button type="button" variant="outline" className="h-11 font-bold" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="button" className="h-11 font-bold" onClick={() => setStep(3)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2 font-headline"><Banknote className="h-5 w-5" /> Financial Profile</CardTitle>
                <CardDescription>Record tenancy financials for reporting.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                        <FormItem><FormLabel>Purchase Price (£)</FormLabel><FormControl><Input id="prop-price" name="purchasePrice" type="number" step="0.01" className="h-11" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="currentValuation" render={({ field }) => (
                        <FormItem><FormLabel>Current Valuation (£)</FormLabel><FormControl><Input id="prop-val" name="currentValuation" type="number" step="0.01" className="h-11" {...field} value={field.value ?? ''}/></FormControl></FormItem>
                    )} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                    <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (
                        <FormItem><FormLabel>Monthly Rent (£)</FormLabel><FormControl><Input id="prop-rent" name="monthlyRent" type="number" step="0.01" className="h-11" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (
                        <FormItem><FormLabel>Deposit Held (£)</FormLabel><FormControl><Input id="prop-deposit" name="depositAmount" type="number" step="0.01" className="h-11" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t pt-6">
                  <Button type="button" variant="outline" className="h-11 font-bold" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="button" className="h-11 font-bold" onClick={() => setStep(4)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2 font-headline"><Images className="h-5 w-5" /> Photo Gallery</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-8">
                <div className="space-y-4">
                  <Label className="font-bold text-lg">Primary Identity Photo</Label>
                  <FormDescription className="text-xs">This photo will be used for the property grid and automatically added to the gallery.</FormDescription>
                  {mainPreview ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary group shadow-lg bg-background">
                      <Image 
                        src={mainPreview} 
                        alt="Identity Preview" 
                        fill 
                        className="object-cover" 
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => mainInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Change</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => { setMainPreview(null); setMainFile(null); }}><X className="mr-2 h-4 w-4" /> Remove</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer bg-muted/5 hover:bg-muted/10 transition-colors" onClick={() => mainInputRef.current?.click()}>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm font-bold">Assign Asset Identity Photo</p>
                    </div>
                  )}
                  <input id="main-photo" name="mainPhoto" type="file" ref={mainInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} />
                </div>

                <div className="space-y-4 pt-6 border-t">
                    <div className="flex items-center justify-between">
                        <Label className="font-bold">Additional Property Photos</Label>
                        <Button type="button" variant="outline" size="sm" className="font-bold" onClick={() => galleryInputRef.current?.click()}><PlusCircle className="mr-2 h-4 w-4" /> Add Files</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {galleryPreviews.map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm bg-background">
                                <Image 
                                  src={url} 
                                  alt={`Pending Gallery Photo ${idx}`} 
                                  fill 
                                  className="object-cover" 
                                  unoptimized
                                />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg" onClick={() => removeGalleryImage(idx)}><X className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>
                    <input id="gallery-photos" name="galleryPhotos" type="file" ref={galleryInputRef} className="hidden" multiple accept="image/*" onChange={handleGalleryChange} />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t pt-6">
                <Button type="button" variant="outline" className="h-11 font-bold" onClick={() => setStep(3)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="submit" disabled={isSubmitting} className="h-11 px-10 shadow-lg bg-primary hover:bg-primary/90 font-bold uppercase tracking-widest text-xs">
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synchronizing Assets...</> : 'Complete Onboarding'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </form>
      </Form>
=======
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
>>>>>>> 4198aad8742ab8507a170630aec42ef56984a310
    </div>
  );
}
