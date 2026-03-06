'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { uploadPropertyImage } from '@/lib/upload-image';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import {
  Loader2, Home, Images, PlusCircle, X, Upload, MapPin, ChevronRight, ChevronLeft, ShieldAlert
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

  // File state for Supabase upload on final submit
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

  const onSubmit = async (data: PropertyFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
      const propertiesCollection = collection(firestore, 'userProfiles', user.uid, 'properties');
      
      // Step 1: Create the document first to get the ID
      const docRef = await addDoc(propertiesCollection, {
        ...JSON.parse(JSON.stringify(data)),
        ownerId: user.uid,
        createdDate: new Date().toISOString(),
      });

      // Step 2: Upload images to Supabase using the new ID for folder organization
      let finalImageUrl = '';
      if (mainFile) {
        finalImageUrl = await uploadPropertyImage(mainFile, user.uid, docRef.id);
      }

      let additionalUrls: string[] = [];
      if (galleryFiles.length > 0) {
        const uploadPromises = galleryFiles.map(f => uploadPropertyImage(f, user.uid, docRef.id));
        additionalUrls = await Promise.all(uploadPromises);
      }

      // Step 3: Update the record with the final public URLs
      await updateDoc(docRef, { 
        imageUrl: finalImageUrl, 
        additionalImageUrls: additionalUrls.filter(Boolean) 
      });

      toast({ 
        title: 'Property Onboarded', 
        description: 'Asset successfully added to your portfolio with all media synced.' 
      });
      
      // Navigate after success
      router.push('/dashboard/properties');
    } catch (err: any) {
      console.error('Onboarding failed:', err);
      toast({ 
        variant: 'destructive', 
        title: 'Onboarding Failed', 
        description: "There was an error synchronizing your property media. Please check your connection."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (step / 4) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-headline text-primary">Onboard Property</h1>
          <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Step {step} of 4</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {step === 1 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Location Profile</CardTitle>
                <CardDescription>Enter the verified address for your asset.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-addr-number">Building Name/No</FormLabel><FormControl><Input id="onboard-addr-number" name="address.nameOrNumber" placeholder="e.g. Flat 1" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address.street" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-addr-street">Street Address</FormLabel><FormControl><Input id="onboard-addr-street" name="address.street" placeholder="High Street" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="address.city" render={({ field }) => (
                      <FormItem><FormLabel htmlFor="onboard-addr-city">City</FormLabel><FormControl><Input id="onboard-addr-city" name="address.city" placeholder="London" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="address.postcode" render={({ field }) => (
                      <FormItem><FormLabel htmlFor="onboard-addr-postcode">Postcode</FormLabel><FormControl><Input id="onboard-addr-postcode" name="address.postcode" placeholder="W1A 1AA" className="uppercase h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="address.county" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-addr-county">County</FormLabel><FormControl><Input id="onboard-addr-county" name="address.county" placeholder="Surrey" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="aspect-square rounded-2xl overflow-hidden border-2 bg-muted relative shadow-inner">
                  {mapUrl ? <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} title="Location Map" /> : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40"><MapPin className="h-12 w-12 mb-2" /><p className="text-xs font-bold uppercase tracking-widest">Awaiting Address...</p></div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t pt-6 bg-muted/5">
                <Button type="button" className="font-bold uppercase tracking-widest text-xs h-11 px-8" onClick={() => setStep(2)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Property Specs</CardTitle>
                <CardDescription>Core architectural and operational details.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="propertyType" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-type-select">Asset Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="onboard-type-select" name="propertyType" className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent>{['House', 'Flat', 'HMO', 'Bungalow', 'Studio'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-status-select">Portfolio Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger id="onboard-status-select" name="status" className="h-11"><SelectValue /></SelectTrigger></FormControl><SelectContent>{['Vacant', 'Occupied', 'Under Maintenance'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <FormField control={form.control} name="bedrooms" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-beds">Bedrooms</FormLabel><FormControl><Input id="onboard-beds" name="bedrooms" type="number" className="h-11" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="bathrooms" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-baths">Bathrooms</FormLabel><FormControl><Input id="onboard-baths" name="bathrooms" type="number" className="h-11" {...field} /></FormControl></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel htmlFor="onboard-internal-notes">Confidential Audit Notes</FormLabel><FormControl><Textarea id="onboard-internal-notes" name="notes" rows={4} className="resize-none rounded-xl" {...field} /></FormControl></FormItem>
                )} />
              </CardContent>
              <CardFooter className="justify-between border-t pt-6 bg-muted/5">
                <Button type="button" variant="outline" className="font-bold uppercase tracking-widest text-xs h-11" onClick={() => setStep(1)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="button" className="font-bold uppercase tracking-widest text-xs h-11 px-8" onClick={() => setStep(3)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Financial Profile</CardTitle>
                <CardDescription>Valuation and projected yields.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-purchase">Purchase Price (£)</FormLabel><FormControl><Input id="onboard-purchase" name="purchasePrice" type="number" className="h-11" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="currentValuation" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-valuation">Market Valuation (£)</FormLabel><FormControl><Input id="onboard-valuation" name="currentValuation" type="number" className="h-11" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                  )} />
                </div>
                <div className="pt-6 border-t space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-primary">Tenancy Terms</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (
                      <FormItem><FormLabel htmlFor="onboard-rent">Agreed Rent (£/mo)</FormLabel><FormControl><Input id="onboard-rent" name="monthlyRent" type="number" className="h-11" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                    )} />
                    <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (
                      <FormItem><FormLabel htmlFor="onboard-deposit">Security Deposit (£)</FormLabel><FormControl><Input id="onboard-deposit" name="depositAmount" type="number" className="h-11" {...field} value={field.value ?? ''} /></FormControl></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="onboard-scheme">Protection Scheme</FormLabel><FormControl><Input id="onboard-scheme" name="depositScheme" placeholder="e.g. DPS" className="h-11" {...field} /></FormControl></FormItem>
                  )} />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t pt-6 bg-muted/5">
                <Button type="button" variant="outline" className="font-bold uppercase tracking-widest text-xs h-11" onClick={() => setStep(2)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="button" className="font-bold uppercase tracking-widest text-xs h-11 px-8" onClick={() => setStep(4)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
              </CardFooter>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b">
                <CardTitle className="flex items-center gap-2"><Images className="h-5 w-5" /> Media Gallery</CardTitle>
                <CardDescription>Visual identification for portfolio reporting.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                <div className="space-y-4">
                  <Label htmlFor="onboard-main-photo-drop" className="font-bold">Primary Identification Photo</Label>
                  {mainPreview ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary group bg-muted/10 shadow-lg">
                      <Image src={mainPreview} alt="Main Preview" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => mainInputRef.current?.click()}>Change Image</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => { setMainPreview(null); setMainFile(null); }}>Remove</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer hover:bg-muted/5 transition-colors border-primary/20" onClick={() => mainInputRef.current?.click()}>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Assign Identity Photo</p>
                    </div>
                  )}
                  <input id="onboard-main-photo-drop" name="mainPhoto" type="file" ref={mainInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} />
                </div>

                <div className="space-y-4 pt-6 border-t">
                  <Label htmlFor="onboard-gallery-drop" className="font-bold">Asset Gallery (Multiple)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {galleryPreviews.map((url, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm">
                        <Image src={url} alt={`Gallery ${idx}`} fill className="object-cover" />
                        <Button type="button" variant="destructive" size="icon" className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setGalleryPreviews(p => p.filter((_, i) => i !== idx)); setGalleryFiles(f => f.filter((_, i) => i !== idx)); }}><X className="h-3 w-3" /></Button>
                      </div>
                    ))}
                    <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/5 min-h-[100px] border-primary/10" onClick={() => galleryInputRef.current?.click()}>
                      <PlusCircle className="h-6 w-6 text-muted-foreground opacity-50" /><span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Add Photos</span>
                    </div>
                  </div>
                  <input id="onboard-gallery-drop" name="galleryPhotos" type="file" ref={galleryInputRef} className="hidden" accept="image/*" multiple onChange={handleGalleryFilesChange} />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t pt-6 bg-muted/5">
                <Button type="button" variant="outline" className="font-bold uppercase tracking-widest text-xs h-11" onClick={() => setStep(3)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="submit" disabled={isSubmitting} className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg bg-primary hover:bg-primary/90">
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing Media...</> : 'Complete Onboarding'}
                </Button>
              </CardFooter>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}
