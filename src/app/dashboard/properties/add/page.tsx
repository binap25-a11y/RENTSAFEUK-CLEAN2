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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import { Loader2, Home, Images, PlusCircle, X, Upload, MapPin, ChevronRight, ChevronLeft } from 'lucide-react';
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

  const onSubmit = async (data: PropertyFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
      const docRef = await addDoc(collection(firestore, 'userProfiles', user.uid, 'properties'), {
        ...JSON.parse(JSON.stringify(data)),
        ownerId: user.uid,
        createdDate: new Date().toISOString(),
      });

      let finalImageUrl = '';
      if (mainFile) {
        finalImageUrl = await uploadPropertyImage(mainFile, user.uid, docRef.id);
      }

      let additionalUrls: string[] = [];
      if (galleryFiles.length > 0) {
        const uploads = await Promise.all(galleryFiles.map(f => uploadPropertyImage(f, user.uid, docRef.id)));
        additionalUrls = uploads.filter(Boolean);
      }

      await updateDoc(docRef, { imageUrl: finalImageUrl, additionalImageUrls: additionalUrls });
      toast({ title: 'Property Onboarded', description: 'Asset added successfully.' });
      router.push('/dashboard/properties');
    } catch (err) {
      console.error('Onboarding failed:', err);
      toast({ variant: 'destructive', title: 'Onboarding Failed' });
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
              </CardHeader>
              <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="addr-name-number">Building Name/No</FormLabel><FormControl><Input id="addr-name-number" name="nameOrNumber" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="address.street" render={({ field }) => (
                    <FormItem><FormLabel htmlFor="addr-street">Street Address</FormLabel><FormControl><Input id="addr-street" name="street" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="address.city" render={({ field }) => (
                      <FormItem><FormLabel htmlFor="addr-city">City</FormLabel><FormControl><Input id="addr-city" name="city" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="address.postcode" render={({ field }) => (
                      <FormItem><FormLabel htmlFor="addr-postcode">Postcode</FormLabel><FormControl><Input id="addr-postcode" name="postcode" className="uppercase h-11" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>
                <div className="aspect-square rounded-2xl overflow-hidden border-2 bg-muted relative">
                  {mapUrl ? <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} /> : <div className="flex items-center justify-center h-full"><MapPin className="h-12 w-12 text-muted-foreground/40" /></div>}
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t pt-6"><Button type="button" className="h-11 px-8" onClick={() => setStep(2)}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button></CardFooter>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-none shadow-xl">
              <CardHeader className="bg-primary/5 border-b"><CardTitle className="flex items-center gap-2"><Images className="h-5 w-5" /> Media Gallery</CardTitle></CardHeader>
              <CardContent className="pt-6 space-y-8">
                <div className="space-y-4">
                  <Label htmlFor="main-photo-picker" className="font-bold">Primary Identification Photo</Label>
                  {mainPreview ? (
                    <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary group">
                      <Image src={mainPreview} alt="Main" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => mainInputRef.current?.click()}>Change Image</Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => { setMainPreview(null); setMainFile(null); }}>Remove</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer" onClick={() => mainInputRef.current?.click()}>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm font-bold">Assign Identity Photo</p>
                    </div>
                  )}
                  <input id="main-photo-picker" name="mainPhoto" type="file" ref={mainInputRef} className="hidden" accept="image/*" onChange={handleMainFileChange} />
                </div>
              </CardContent>
              <CardFooter className="justify-between border-t pt-6">
                <Button type="button" variant="outline" className="h-11" onClick={() => setStep(3)}><ChevronLeft className="mr-2 h-4 w-4" /> Back</Button>
                <Button type="submit" disabled={isSubmitting} className="h-11 px-10 shadow-lg">
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing Media...</> : 'Complete Onboarding'}
                </Button>
              </CardFooter>
            </Card>
          )}
          {/* Add other steps as needed, mirroring the same id/name logic */}
        </form>
      </Form>
    </div>
  );
}
