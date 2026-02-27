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
import { useUser, useFirestore, useDoc, useMemoFirebase, useFirebase } from '@/firebase';
import { doc, setDoc, query, collection, where, getDocs, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, ShieldAlert, MapPin, Home, Building, Hotel, Building2, Warehouse, Upload, X } from 'lucide-react';
import Image from 'next/image';

// Robust UK Postcode Regex
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
  bedrooms: z.coerce.number().nonnegative('Cannot be negative'),
  bathrooms: z.coerce.number().nonnegative('Cannot be negative'),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  purchasePrice: z.coerce.number().nonnegative('Cannot be negative').optional(),
  currentValuation: z.coerce.number().nonnegative('Cannot be negative').optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().nonnegative('Cannot be negative').optional(),
    depositAmount: z.coerce.number().nonnegative('Cannot be negative').optional(),
    depositScheme: z.string().optional(),
  }).optional(),
}).refine(data => {
  if (!data.tenancy?.depositAmount || data.tenancy.depositAmount <= 0) {
    return true;
  }
  return !!(data.tenancy.depositScheme && data.tenancy.depositScheme.trim());
}, {
  message: "Deposit scheme is required if a deposit amount is entered.",
  path: ["tenancy", "depositScheme"]
});

type PropertyFormValues = z.infer<typeof propertySchema>;

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
  const { firestore, storage } = useFirebase();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
  }, [firestore, user, propertyId]);
  
  const { data: property, isLoading } = useDoc(propertyRef);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: {
        nameOrNumber: '',
        street: '',
        city: '',
        county: '',
        postcode: '',
      },
      propertyType: 'House',
      bedrooms: 0,
      bathrooms: 0,
      status: 'Vacant',
      notes: '',
      tenancy: {
        monthlyRent: undefined,
        depositAmount: undefined,
        depositScheme: '',
      },
    },
  });

  useEffect(() => {
    if (property) {
      form.reset({
        address: property.address || {
          nameOrNumber: '',
          street: '',
          city: '',
          county: '',
          postcode: '',
        },
        propertyType: property.propertyType || 'House',
        status: property.status || 'Vacant',
        bedrooms: property.bedrooms || 0,
        bathrooms: property.bathrooms || 0,
        notes: property.notes || '',
        imageUrl: property.imageUrl || '',
        purchasePrice: property.purchasePrice,
        currentValuation: property.currentValuation,
        tenancy: property.tenancy || {
          monthlyRent: undefined,
          depositAmount: undefined,
          depositScheme: '',
        },
      });
      if (property.imageUrl) {
        setPreviewUrl(property.imageUrl);
      }
    }
  }, [property, form]);

  const watchAddress = form.watch('address');
  
  const mapUrl = useMemo(() => {
    if (!watchAddress) return null;
    const { street, city, county, postcode } = watchAddress;
    const fullAddress = [street, city, county, postcode].filter(Boolean).join(', ');
    if (fullAddress.length < 5) return null;
    return `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`;
  }, [watchAddress]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setPreviewUrl(property?.imageUrl || null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  async function onSubmit(data: PropertyFormValues) {
    if (!firestore || !propertyId || !user || !storage) return;
    
    setIsSubmitting(true);

    try {
      // UNIQUENESS CHECK
      if (data.address.street !== property?.address.street || data.address.postcode !== property?.address.postcode) {
          const propertiesCollection = collection(firestore, 'userProfiles', user.uid, 'properties');
          const duplicateQuery = query(
              propertiesCollection,
              where('address.street', '==', data.address.street),
              where('address.postcode', '==', data.address.postcode),
              where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
              limit(1)
          );
          const duplicateSnap = await getDocs(duplicateQuery);
          if (!duplicateSnap.empty && duplicateSnap.docs[0].id !== propertyId) {
              toast({
                  variant: 'destructive',
                  title: 'Duplicate Property',
                  description: 'Another active property with this street and postcode already exists.',
              });
              setIsSubmitting(false);
              return;
          }
      }

      // Handle image upload if a new file was selected
      let imageUrl = data.imageUrl || '';
      if (selectedFile) {
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `main-photo-${Date.now()}.${fileExt}`;
          const storageRef = ref(storage, `images/${user.uid}/${propertyId}/${fileName}`);
          const uploadSnap = await uploadBytes(storageRef, selectedFile);
          imageUrl = await getDownloadURL(uploadSnap.ref);
      }

      const docRef = doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
      const cleanedData = JSON.parse(JSON.stringify({
          ...data,
          imageUrl,
          ownerId: user.uid
      }));
      
      await setDoc(docRef, cleanedData, { merge: true });
      
      toast({ title: "Property Record Updated" });
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (e) {
      console.error("Update failed:", e);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not sync changes to the database." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
      <Card className="max-w-5xl mx-auto shadow-md border-none">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-2xl font-headline text-primary">Edit Portfolio Property</CardTitle>
        <CardDescription>Refine location data and financial parameters for your property record.</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <Card className="border-none shadow-none bg-muted/20">
                    <CardHeader><CardTitle className="text-lg font-headline">Verified Address</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (<FormItem><FormLabel>Building Name/No</FormLabel><FormControl><Input placeholder="e.g. Flat 1 or 12" className="h-11 bg-background" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="address.street" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="e.g. High Street" className="h-11 bg-background" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="address.city" render={({ field }) => (<FormItem><FormLabel>City/Town</FormLabel><FormControl><Input placeholder="London" className="h-11 bg-background" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="address.county" render={({ field }) => (<FormItem><FormLabel>County</FormLabel><FormControl><Input placeholder="e.g. Surrey" className="h-11 bg-background" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="address.postcode" render={({ field }) => (<FormItem><FormLabel>Post Code</FormLabel><FormControl><Input placeholder="W1A 1AA" className="uppercase h-11 bg-background" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <FormLabel className="font-bold flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Geo-Location Verification
                    </FormLabel>
                    <div className="aspect-square w-full rounded-2xl overflow-hidden border-2 border-muted bg-muted shadow-inner relative">
                        {mapUrl ? (
                            <iframe width="100%" height="100%" style={{ border: 0 }} title="Property Map" loading="lazy" src={mapUrl}></iframe>
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-muted-foreground/40">
                                <MapPin className="h-12 w-12 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest text-center">Address resolution pending...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <Card className="border-none shadow-none bg-muted/20">
                    <CardHeader><CardTitle className="text-lg font-headline">Investment & Tenancy</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Purchase Price (£)</FormLabel>
                            <FormControl><Input type="number" min="0" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="currentValuation" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Current Valuation (£)</FormLabel>
                            <FormControl><Input type="number" min="0" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                        </div>
                        <div className="pt-6 border-t border-muted-foreground/10 space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4" />
                                Protection Compliance
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Gross Monthly Rent (£)</FormLabel>
                                    <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )} />
                                <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Security Deposit (£)</FormLabel>
                                    <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11 bg-background" {...field} value={field.value ?? ''} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )} />
                            </div>
                            <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Deposit Protection Scheme</FormLabel>
                                    <FormControl><Input placeholder="e.g. DPS, TDS, MyDeposits" className="h-11 bg-background" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    <FormLabel className="font-bold flex items-center gap-2 text-lg">
                        <Upload className="h-5 w-5 text-primary" />
                        Main Property Identity Media
                    </FormLabel>
                    
                    {previewUrl ? (
                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border shadow-lg group bg-muted/10">
                            <Image src={previewUrl} alt="Current Property Photo" fill className="object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> Replace Photo
                                </Button>
                                <Button type="button" variant="destructive" size="sm" onClick={removeFile}>
                                    <X className="mr-2 h-4 w-4" /> Remove
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            className="border-2 border-dashed border-muted-foreground/20 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 bg-muted/5 group hover:border-primary/50 transition-colors cursor-pointer aspect-[4/3]"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors" />
                            <div className="space-y-1">
                                <p className="font-bold">Assign Property Photo</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Secure Cloud Storage (10MB limit)</p>
                            </div>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>
            </div>

            <Card className="border-none shadow-none bg-muted/20">
              <CardHeader><CardTitle className="text-lg font-headline">Core Specification</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField control={form.control} name="propertyType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Architectural Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 bg-background">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {propertyTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Portfolio Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11 bg-background">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['Vacant', 'Occupied', 'Under Maintenance'].map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
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
                      <FormLabel>Bedrooms</FormLabel>
                      <FormControl><Input type="number" min="0" className="h-11 bg-background" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="bathrooms" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bathrooms</FormLabel>
                      <FormControl><Input type="number" min="0" className="h-11 bg-background" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Confidential Audit Notes</FormLabel>
                        <FormControl>
                            <Textarea rows={5} className="bg-background resize-none" placeholder="Describe unique features, maintenance history, or specific landlord observations..." {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button type="button" variant="ghost" className="font-bold uppercase tracking-widest text-xs h-11" asChild><Link href={`/dashboard/properties/${propertyId}`}>Cancel</Link></Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing Data...</> : 'Save Portfolio Updates'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
