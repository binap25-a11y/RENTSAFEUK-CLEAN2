'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { uploadPropertyImage } from '@/lib/upload-image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import { Loader2, Home, Images, PlusCircle, X, Upload, MapPin, ChevronRight, ChevronLeft, Banknote } from 'lucide-react';
import { Label } from '@/components/ui/label';

const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;

const propertySchema = z.object({
  address: z.object({
    nameOrNumber: z.string().trim().optional(),
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
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
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

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainFile(file);
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
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
      // Step 1: Create initial record
      const docRef = await addDoc(collection(firestore, 'userProfiles', user.uid, 'properties'), {
        ...JSON.parse(JSON.stringify(data)),
        ownerId: user.uid,
        createdDate: new Date().toISOString(),
        imageUrl: '',
        additionalImageUrls: [],
      });

      // Step 2: Upload Identity Photo
      let finalIdentityUrl = '';
      if (mainFile) {
        try {
          finalIdentityUrl = await uploadPropertyImage(mainFile, user.uid, docRef.id);
        } catch (uploadErr: any) {
          console.error('Identity photo sync failure:', uploadErr);
          toast({ variant: 'destructive', title: 'Upload Error', description: uploadErr.message });
        }
      }

      // Step 3: Upload Gallery Photos
      let galleryUrls: string[] = [];
      if (galleryFiles.length > 0) {
        try {
          const uploads = await Promise.all(galleryFiles.map(f => uploadPropertyImage(f, user.uid, docRef.id)));
          galleryUrls = uploads.filter(Boolean);
        } catch (uploadErr: any) {
          console.error('Gallery sync failure:', uploadErr);
        }
      }

      // Mirror identity photo into gallery as requested
      const finalGallery = [...galleryUrls];
      if (finalIdentityUrl && !finalGallery.includes(finalIdentityUrl)) {
        finalGallery.unshift(finalIdentityUrl);
      }

      // Finalize Firestore record
      await updateDoc(docRef, { 
          imageUrl: finalIdentityUrl || '', 
          additionalImageUrls: finalGallery 
      });

      toast({ title: 'Property Onboarded', description: 'Asset data and media synchronized.' });
      router.push('/dashboard/properties');
    } catch (err: any) {
      console.error('Critical onboarding failure:', err);
      toast({ variant: 'destructive', title: 'Onboarding Failed', description: err.message || 'Check connection and try again.' });
    } finally {
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
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Location Profile</CardTitle>
                <CardDescription>Enter the property address to verify location.</CardDescription>
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
              <CardFooter className="justify-end border-t pt-6"><Button type="button" className="h-11 px-8" onClick={() => setStep(2)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button></CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Property Characteristics</CardTitle>
                <CardDescription>Define the physical attributes of the rental unit.</CardDescription>
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
                  <Button type="button" variant="outline" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="button" onClick={() => setStep(3)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" /> Financial Setup</CardTitle>
                <CardDescription>Record expected tenancy financials.</CardDescription>
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
                  <Button type="button" variant="outline" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                  <Button type="button" onClick={() => setStep(4)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2"><Images className="h-5 w-5" /> Media Gallery</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-8">
                <div className="space-y-4">
                  <Label>Primary Identification Photo</Label>
                  <FormDescription>Assign a primary photo for the property grid and overview. This image will also be added to the gallery.</FormDescription>
                  {mainPreview ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary group shadow-lg">
                      <Image 
                        src={mainPreview} 
                        alt="Main Preview" 
                        fill 
                        className="object-cover" 
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => mainInputRef.current?.click()}>Change Image</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => { setMainPreview(null); setMainFile(null); }}>Remove</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer bg-muted/5 hover:bg-muted/10 transition-colors" onClick={() => mainInputRef.current?.click()}>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm font-bold">Assign Identity Photo</p>
                    </div>
                  )}
                  <input id="main-photo" name="mainPhoto" type="file" ref={mainInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} />
                </div>

                <div className="space-y-4 pt-6 border-t">
                    <div className="flex items-center justify-between">
                        <Label>Additional Asset Photos</Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => galleryInputRef.current?.click()}><PlusCircle className="mr-2 h-4 w-4" /> Add Media</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {galleryPreviews.map((url, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm">
                                <Image 
                                  src={url} 
                                  alt={`Gallery Preview ${idx}`} 
                                  fill 
                                  className="object-cover" 
                                  unoptimized
                                />
                                <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeGalleryImage(idx)}><X className="h-3 w-3" /></Button>
                            </div>
                        ))}
                    </div>
                    <input id="gallery-photos" name="galleryPhotos" type="file" ref={galleryInputRef} className="hidden" multiple accept="image/*" onChange={handleGalleryChange} />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t pt-6">
                <Button type="button" variant="outline" className="h-11" onClick={() => setStep(3)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="submit" disabled={isSubmitting} className="h-11 px-10 shadow-lg bg-primary hover:bg-primary/90">
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing Assets...</> : 'Complete Onboarding'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}
