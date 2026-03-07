'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadPropertyImage } from '@/lib/upload-image';
import { Loader2, MapPin, Home, Upload, X, Images, PlusCircle } from 'lucide-react';
import Image from 'next/image';

const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;

const propertySchema = z.object({
  address: z.object({
    nameOrNumber: z.string().trim().optional(),
    street: z.string().trim().min(3, 'Please enter a valid street address.'),
    city: z.string().trim().min(2, 'Please enter a valid city or town.'),
    county: z.string().trim().min(2, 'Please enter a county.'),
    postcode: z.string().trim().regex(ukPostcodeRegex, 'Please enter a valid UK postcode.'),
  }),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
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

interface Property {
    id: string;
    ownerId: string;
    address: {
      nameOrNumber?: string;
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
    propertyType: string;
    status: string;
    bedrooms: number;
    bathrooms: number;
    imageUrl?: string;
    additionalImageUrls?: string[];
    notes?: string;
    purchasePrice?: number;
    currentValuation?: number;
    tenancy?: {
        monthlyRent?: number;
        depositAmount?: number;
        depositScheme?: string;
    };
}

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Primary Asset Identity Logic
  const [selectedMainFile, setSelectedMainFile] = useState<File | null>(null);
  const [mainPreviewUrl, setMainPreviewUrl] = useState<string | null>(null);
  const [isMainRemoved, setIsMainRemoved] = useState(false);
  const mainInputRef = useRef<HTMLInputElement>(null);

  // Gallery Logic
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [newGalleryFiles, setNewGalleryFiles] = useState<File[]>([]);
  const [newGalleryPreviews, setNewGalleryPreviews] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
  }, [firestore, user, propertyId]);
  const { data: property, isLoading } = useDoc<Property>(propertyRef);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: { nameOrNumber: '', street: '', city: '', county: '', postcode: '' },
      propertyType: 'House',
      bedrooms: 0,
      bathrooms: 0,
      status: 'Vacant',
      notes: '',
    },
  });

  useEffect(() => {
    if (property) {
      form.reset({
        address: property.address,
        propertyType: property.propertyType,
        status: property.status,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        notes: property.notes || '',
        purchasePrice: property.purchasePrice,
        currentValuation: property.currentValuation,
        tenancy: property.tenancy,
      });
      if (property.imageUrl) {
          setMainPreviewUrl(property.imageUrl);
          setIsMainRemoved(false);
      }
      if (property.additionalImageUrls) {
          setExistingGallery(property.additionalImageUrls);
      }
    }
  }, [property, form]);

  const { street, city, county, postcode } = form.watch('address');
  const mapUrl = useMemo(() => {
    const parts = [street, city, county, postcode].filter(p => !!p && p.trim().length > 0);
    if (parts.length === 0) return null;
    return `https://maps.google.com/maps?q=${encodeURIComponent(parts.join(', '))}&output=embed`;
  }, [street, city, county, postcode]);

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMainFile(file);
      setIsMainRemoved(false);
      if (mainPreviewUrl && mainPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(mainPreviewUrl);
      setMainPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleNewGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setNewGalleryFiles(prev => [...prev, ...files]);
      const previews = files.map(f => URL.createObjectURL(f));
      setNewGalleryPreviews(prev => [...prev, ...previews]);
  };

  const removeNewGalleryImage = (idx: number) => {
      setNewGalleryFiles(prev => prev.filter((_, i) => i !== idx));
      if (newGalleryPreviews[idx].startsWith('blob:')) URL.revokeObjectURL(newGalleryPreviews[idx]);
      setNewGalleryPreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(data: PropertyFormValues) {
    if (!firestore || !propertyId || !user) return;
    setIsSubmitting(true);

    try {
      // Step 1: Handle Primary Identity Photo Upload
      let finalIdentityUrl = isMainRemoved ? '' : (property?.imageUrl || '');
      
      if (selectedMainFile) {
          try {
            finalIdentityUrl = await uploadPropertyImage(selectedMainFile, user.uid, propertyId);
          } catch (uploadErr: any) {
            console.error('Identity media synchronization failure:', uploadErr);
            toast({ variant: 'destructive', title: 'Upload Failed', description: uploadErr.message || 'Failed to upload new identity photo.' });
            setIsSubmitting(false);
            return;
          }
      }

      // Step 2: Handle Gallery Uploads
      const newGalleryUrls: string[] = [];
      if (newGalleryFiles.length > 0) {
          try {
            const uploads = await Promise.all(newGalleryFiles.map(f => uploadPropertyImage(f, user.uid, propertyId)));
            newGalleryUrls.push(...uploads.filter(Boolean));
          } catch (uploadErr: any) {
            console.error('Gallery synchronization issue:', uploadErr);
          }
      }

      // Step 3: Reconstruct and Validate Full Gallery
      let combinedGallery = [...existingGallery, ...newGalleryUrls];
      
      // Mirror identity photo into gallery if it's new or was changed
      if (finalIdentityUrl && !combinedGallery.includes(finalIdentityUrl)) {
          combinedGallery.unshift(finalIdentityUrl);
      }

      // If main was removed and not replaced, clean it from gallery too
      if (isMainRemoved && !selectedMainFile && property?.imageUrl) {
          combinedGallery = combinedGallery.filter(url => url !== property.imageUrl);
      }

      const updatePayload = {
          ...data,
          imageUrl: finalIdentityUrl,
          additionalImageUrls: combinedGallery,
          ownerId: user.uid
      };

      // Sanitize payload for Firestore
      const sanitizedPayload = JSON.parse(JSON.stringify(updatePayload));

      await updateDoc(doc(firestore, 'userProfiles', user.uid, 'properties', propertyId), sanitizedPayload);
      toast({ title: "Portfolio Updated", description: "Property records and media storage synchronized." });
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (e: any) {
      console.error("Critical sync failure:", e);
      toast({ variant: "destructive", title: "Update Failed", description: e.message || "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
      <Card className="max-w-5xl mx-auto shadow-md border-none">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-2xl font-headline text-primary">Edit Property Record</CardTitle>
        <CardDescription>Update asset identification and contract details.</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <Card className="border-none shadow-none bg-muted/20">
                    <CardHeader><CardTitle className="text-lg font-headline">Verified Address</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Building Name/No</FormLabel>
                            <FormControl><Input id="edit-no" name="nameOrNumber" className="h-11 bg-background" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="address.street" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address</FormLabel>
                            <FormControl><Input id="edit-street" name="street" className="h-11 bg-background" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="address.city" render={({ field }) => (
                              <FormItem><FormLabel>City</FormLabel><FormControl><Input id="edit-city" name="city" className="h-11 bg-background" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="address.postcode" render={({ field }) => (
                              <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input id="edit-postcode" name="postcode" className="uppercase h-11 bg-background" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>
                <div className="aspect-square rounded-2xl overflow-hidden border-2 bg-muted relative">
                    {mapUrl ? <iframe src={mapUrl} width="100%" height="100%" style={{ border: 0 }} title="Property Map" /> : <div className="flex items-center justify-center h-full text-muted-foreground"><MapPin className="mr-2" /> Awaiting location...</div>}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 border-t pt-10">
                <div className="space-y-6">
                    <FormLabel className="font-bold flex items-center gap-2 text-lg"><Home className="h-5 w-5 text-primary" /> Identity Photo</FormLabel>
                    <FormDescription className="text-xs">Primary photo for the grid view. Also added to your gallery.</FormDescription>
                    {mainPreviewUrl ? (
                        <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-primary shadow-lg group">
                            <Image 
                              src={mainPreviewUrl} 
                              alt="Primary Asset Identity" 
                              fill 
                              className="object-cover" 
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button type="button" variant="secondary" size="sm" onClick={() => mainInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Change</Button>
                                <Button type="button" variant="destructive" size="sm" onClick={() => { setSelectedMainFile(null); setMainPreviewUrl(null); setIsMainRemoved(true); }}><X className="mr-2 h-4 w-4" /> Remove</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed rounded-2xl p-12 text-center bg-muted/5 cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => mainInputRef.current?.click()}>
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                            <p className="text-sm font-bold">Assign Asset Identity Photo</p>
                        </div>
                    )}
                    <input type="file" ref={mainInputRef} onChange={handleMainFileChange} accept="image/*" className="hidden" id="edit-main-photo" name="editMainPhoto" />
                </div>

                <div className="space-y-6">
                    <FormLabel className="font-bold flex items-center gap-2 text-lg"><Images className="h-5 w-5 text-primary" /> Additional Gallery Media</FormLabel>
                    <div className="grid grid-cols-3 gap-4">
                        {existingGallery.map((url, idx) => (
                            <div key={`existing-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm bg-background">
                                <Image 
                                  src={url} 
                                  alt="Gallery Item" 
                                  fill 
                                  className="object-cover" 
                                  unoptimized
                                />
                                <button type="button" onClick={() => setExistingGallery(p => p.filter(u => u !== url))} className="absolute top-1.5 right-1.5 p-1 bg-destructive/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive shadow-md"><X className="h-3 w-3" /></button>
                            </div>
                        ))}
                        {newGalleryPreviews.map((url, idx) => (
                            <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-primary/50 group bg-background">
                                <Image src={url} alt="Pending Upload" fill className="object-cover" unoptimized />
                                <button type="button" onClick={() => removeNewGalleryImage(idx)} className="absolute top-1.5 right-1.5 p-1 bg-destructive/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive shadow-md"><X className="h-3 w-3" /></button>
                            </div>
                        ))}
                        <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 bg-muted/5 cursor-pointer aspect-square hover:bg-muted/10 transition-colors" onClick={() => galleryInputRef.current?.click()}>
                            <PlusCircle className="h-6 w-6 text-muted-foreground" /><span className="text-[10px] font-bold uppercase">Add Media</span>
                        </div>
                    </div>
                    <input type="file" ref={galleryInputRef} multiple onChange={handleNewGalleryChange} accept="image/*" className="hidden" id="edit-gallery" name="editGallery" />
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button type="button" variant="ghost" asChild className="h-11"><Link href={`/dashboard/properties/${propertyId}`}>Cancel</Link></Button>
              <Button type="submit" disabled={isSubmitting} className="h-11 px-10 shadow-lg">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synchronizing Portfolio...</> : 'Save Record Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
