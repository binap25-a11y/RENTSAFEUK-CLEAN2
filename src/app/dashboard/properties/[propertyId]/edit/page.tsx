'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadPropertyImage } from '@/lib/upload-image';
import { Loader2, ShieldAlert, MapPin, Home, Upload, X, Images, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  bedrooms: z.coerce.number().min(0, 'Cannot be negative'),
  bathrooms: z.coerce.number().min(0, 'Cannot be negative'),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  additionalImageUrls: z.array(z.string()).optional(),
  purchasePrice: z.coerce.number().min(0, 'Cannot be negative').optional(),
  currentValuation: z.coerce.number().min(0, 'Cannot be negative').optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().min(0, 'Cannot be negative').optional(),
    depositAmount: z.coerce.number().min(0, 'Cannot be negative').optional(),
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

const propertyTypes = [
  { value: 'House', label: 'House' },
  { value: 'Flat', label: 'Flat / Apt' },
  { value: 'HMO', label: 'HMO' },
  { value: 'Bungalow', label: 'Bungalow' },
  { value: 'Maisonette', label: 'Maisonette' },
  { value: 'Studio', label: 'Studio' },
];

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;
  
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Media state
  const [selectedMainFile, setSelectedMainFile] = useState<File | null>(null);
  const [mainPreviewUrl, setMainPreviewUrl] = useState<string | null>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);

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
      tenancy: { monthlyRent: undefined, depositAmount: undefined, depositScheme: '' },
    },
  });

  useEffect(() => {
    if (property) {
      form.reset({
        address: {
          nameOrNumber: property.address?.nameOrNumber ?? '',
          street: property.address?.street ?? '',
          city: property.address?.city ?? '',
          county: property.address?.county ?? '',
          postcode: property.address?.postcode ?? '',
        },
        propertyType: property.propertyType || 'House',
        status: property.status || 'Vacant',
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        notes: property.notes || '',
        imageUrl: property.imageUrl || '',
        additionalImageUrls: property.additionalImageUrls || [],
        purchasePrice: property.purchasePrice,
        currentValuation: property.currentValuation,
        tenancy: {
          monthlyRent: property.tenancy?.monthlyRent,
          depositAmount: property.tenancy?.depositAmount,
          depositScheme: property.tenancy?.depositScheme ?? '',
        },
      });
      if (property.imageUrl) setMainPreviewUrl(property.imageUrl);
      if (property.additionalImageUrls) setExistingGallery(property.additionalImageUrls);
    }
  }, [property, form]);

  const street = form.watch('address.street');
  const city = form.watch('address.city');
  const county = form.watch('address.county');
  const postcode = form.watch('address.postcode');
  
  const mapUrl = useMemo(() => {
    const parts = [street, city, county, postcode].filter(p => !!p && p.trim().length > 0);
    if (parts.length === 0) return null;
    const queryStr = parts.join(', ');
    return `https://maps.google.com/maps?q=${encodeURIComponent(queryStr)}&output=embed`;
  }, [street, city, county, postcode]);

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedMainFile(file);
      if (mainPreviewUrl && mainPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(mainPreviewUrl);
      setMainPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleNewGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setNewGalleryFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(f => URL.createObjectURL(f));
      setNewGalleryPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeExistingGalleryImage = (url: string) => {
    setExistingGallery(prev => prev.filter(item => item !== url));
  };

  const removeNewGalleryImage = (index: number) => {
    setNewGalleryFiles(prev => prev.filter((_, i) => i !== index));
    setNewGalleryPreviews(prev => prev.filter((_, i) => i !== index));
  };

  async function onSubmit(data: PropertyFormValues) {
    if (!firestore || !propertyId || !user) return;
    setIsSubmitting(true);

    try {
      let finalImageUrl = '';
      if (selectedMainFile) {
          finalImageUrl = await uploadPropertyImage(selectedMainFile, user.uid, propertyId);
      }

      const newGalleryUrls: string[] = [];
      if (newGalleryFiles.length > 0) {
          const uploadPromises = newGalleryFiles.map(async (file) => {
              return uploadPropertyImage(file, user.uid, propertyId);
          });
          const uploaded = await Promise.all(uploadPromises);
          newGalleryUrls.push(...uploaded.filter(Boolean));
      }

      const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
      
      const updateData: any = {
          ...data,
          additionalImageUrls: [...existingGallery, ...newGalleryUrls],
          ownerId: user.uid
      };
      
      // Only set imageUrl if it's new, otherwise keep existing
      if (finalImageUrl) {
          updateData.imageUrl = finalImageUrl;
      }

      const cleanedData = JSON.parse(JSON.stringify(updateData));
      await updateDoc(docRef, cleanedData);
      
      toast({ title: "Property Record Updated", description: "All changes have been successfully saved." });
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (e) {
      console.error("Update failed:", e);
      toast({ variant: "destructive", title: "Update Failed" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
      <Card className="max-w-5xl mx-auto shadow-md border-none">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-2xl font-headline text-primary">Edit Portfolio Property</CardTitle>
        <CardDescription>Update identity and contract details for your asset.</CardDescription>
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
                            <FormLabel htmlFor="edit-addr-number">Building Name/No</FormLabel>
                            <FormControl><Input id="edit-addr-number" name="nameOrNumber" placeholder="e.g. Flat 1" className="h-11 bg-background" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="address.street" render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="edit-addr-street">Street Address</FormLabel>
                            <FormControl><Input id="edit-addr-street" name="street" placeholder="e.g. High Street" className="h-11 bg-background" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="address.city" render={({ field }) => (
                              <FormItem>
                                <FormLabel htmlFor="edit-addr-city">City/Town</FormLabel>
                                <FormControl><Input id="edit-addr-city" name="city" placeholder="London" className="h-11 bg-background" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="address.county" render={({ field }) => (
                              <FormItem>
                                <FormLabel htmlFor="edit-addr-county">County</FormLabel>
                                <FormControl><Input id="edit-addr-county" name="county" placeholder="e.g. Surrey" className="h-11 bg-background" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="address.postcode" render={({ field }) => (
                          <FormItem>
                            <FormLabel htmlFor="edit-addr-postcode">Post Code</FormLabel>
                            <FormControl><Input id="edit-addr-postcode" name="postcode" placeholder="W1A 1AA" className="uppercase h-11 bg-background" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <FormLabel className="font-bold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Location Verification
                    </FormLabel>
                    <div className="aspect-square w-full rounded-2xl overflow-hidden border-2 border-muted bg-muted shadow-inner relative">
                        {mapUrl ? (
                            <iframe 
                                key={mapUrl}
                                width="100%" 
                                height="100%" 
                                style={{ border: 0 }} 
                                title="Property Map" 
                                src={mapUrl}
                            ></iframe>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-muted-foreground/40">
                                <MapPin className="h-12 w-12 mb-2" />
                                <p className="text-xs font-bold">Awaiting address...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 border-t pt-10">
                <div className="space-y-6">
                    <FormLabel className="font-bold flex items-center gap-2 text-lg">
                        <Home className="h-5 w-5 text-primary" />
                        Portfolio Identity Photo
                    </FormLabel>
                    
                    {mainPreviewUrl ? (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-primary shadow-lg group bg-muted/10">
                            <Image src={mainPreviewUrl} alt="Main" fill className="object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                <Button type="button" variant="secondary" size="sm" onClick={() => mainInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> Replace Photo
                                </Button>
                                <Button type="button" variant="destructive" size="sm" onClick={() => { setSelectedMainFile(null); setMainPreviewUrl(null); }}>
                                    <X className="mr-2 h-4 w-4" /> Remove
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed rounded-2xl p-12 text-center bg-muted/5 cursor-pointer hover:border-primary/50" onClick={() => mainInputRef.current?.click()}>
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                            <p className="text-sm font-bold">Assign Identity Photo</p>
                        </div>
                    )}
                    <input type="file" ref={mainInputRef} onChange={handleMainFileChange} accept="image/*" className="hidden" id="edit-main-photo-input" name="mainPhoto" />
                </div>

                <div className="space-y-6">
                    <FormLabel className="font-bold flex items-center gap-2 text-lg">
                        <Images className="h-5 w-5 text-primary" />
                        Asset Gallery
                    </FormLabel>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {existingGallery.map((url, idx) => (
                            <div key={`existing-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border group">
                                <Image src={url} alt="Gallery" fill className="object-cover" />
                                <button type="button" onClick={() => removeExistingGalleryImage(url)} className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        
                        {newGalleryPreviews.map((preview, idx) => (
                            <div key={`new-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-primary group">
                                <Image src={preview} alt="New" fill className="object-cover" />
                                <Badge className="absolute bottom-1 left-1 h-4 text-[8px] bg-primary">New</Badge>
                                <button type="button" onClick={() => removeNewGalleryImage(idx)} className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}

                        <div className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 bg-muted/5 cursor-pointer hover:border-primary/50 aspect-square" onClick={() => galleryInputRef.current?.click()}>
                            <PlusCircle className="h-6 w-6 text-muted-foreground" />
                            <span className="text-[10px] font-bold">Add Media</span>
                        </div>
                    </div>
                    <input type="file" ref={galleryInputRef} onChange={handleNewGalleryFiles} accept="image/*" multiple className="hidden" id="edit-gallery-photos-input" name="galleryPhotos" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 border-t pt-10">
                <Card className="border-none shadow-none bg-muted/20">
                    <CardHeader><CardTitle className="text-lg font-headline">Investment & Tenancy</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                            <FormItem>
                            <FormLabel htmlFor="edit-purchase-price">Purchase Price (£)</FormLabel>
                            <FormControl><Input id="edit-purchase-price" name="purchasePrice" type="number" min="0" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="currentValuation" render={({ field }) => (
                            <FormItem>
                            <FormLabel htmlFor="edit-valuation">Valuation (£)</FormLabel>
                            <FormControl><Input id="edit-valuation" name="currentValuation" type="number" min="0" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                        </div>
                        <div className="pt-6 border-t border-muted-foreground/10 space-y-4">
                            <h4 className="text-sm font-bold uppercase text-primary">Tenancy Status</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="edit-monthly-rent">Monthly Rent (£)</FormLabel>
                                    <FormControl><Input id="edit-monthly-rent" name="monthlyRent" type="number" min="0" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )} />
                                <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="edit-deposit-amount">Security Deposit (£)</FormLabel>
                                    <FormControl><Input id="edit-deposit-amount" name="depositAmount" type="number" min="0" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="edit-deposit-scheme">Deposit Scheme</FormLabel>
                                    <FormControl><Input id="edit-deposit-scheme" name="depositScheme" placeholder="e.g. DPS" className="h-11 bg-background" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-none bg-muted/20">
                  <CardHeader><CardTitle className="text-lg font-headline">Core Attributes</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormField control={form.control} name="propertyType" render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="edit-type-select">Asset Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger id="edit-type-select" name="propertyType" className="h-11 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {propertyTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="edit-status-select">Portfolio Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger id="edit-status-select" name="status" className="h-11 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {['Vacant', 'Occupied', 'Under Maintenance'].map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <FormField control={form.control} name="bedrooms" render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="edit-bedrooms-input">Bedrooms</FormLabel>
                          <FormControl><Input id="edit-bedrooms-input" name="bedrooms" type="number" min="0" className="h-11 bg-background" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="bathrooms" render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="edit-bathrooms-input">Bathrooms</FormLabel>
                          <FormControl><Input id="edit-bathrooms-input" name="bathrooms" type="number" min="0" className="h-11 bg-background" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="notes" render={({ field }) => (
                        <FormItem>
                            <FormLabel htmlFor="edit-audit-notes">Internal Audit Notes</FormLabel>
                            <FormControl>
                                <Textarea id="edit-audit-notes" name="notes" rows={5} className="bg-background resize-none rounded-xl" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                  </CardContent>
                </Card>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button type="button" variant="ghost" className="font-bold uppercase tracking-widest text-xs h-11" asChild><Link href={`/dashboard/properties/${propertyId}`}>Cancel</Link></Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing Media...</> : 'Save Portfolio Updates'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
