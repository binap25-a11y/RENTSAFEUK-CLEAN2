
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Image from 'next/image';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase, useStorage } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, AlertTriangle, Upload } from 'lucide-react';

const propertySchema = z.object({
  address: z.object({
    nameOrNumber: z.string().optional(),
    street: z.string().min(3, 'Please enter a street address.'),
    city: z.string().min(2, 'Please enter a city or town.'),
    county: z.string().optional(),
    postcode: z.string().min(5, 'Please enter a valid postcode.'),
  }),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  bedrooms: z.coerce.number().min(0, 'Cannot be negative'),
  bathrooms: z.coerce.number().min(0, 'Cannot be negative'),
  notes: z.string().optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().optional(),
    depositAmount: z.coerce.number().optional(),
    depositScheme: z.string().optional(),
  }).optional(),
  images: z.custom<FileList>().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

// This component will only be rendered when property data is loaded.
function EditPropertyForm({ property, onFormSubmit, isSubmitting }: { property: any, onFormSubmit: (data: PropertyFormValues) => void, isSubmitting: boolean }) {
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
        address: property.address || {},
        propertyType: property.propertyType,
        status: property.status,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        notes: property.notes || '',
        tenancy: property.tenancy || {},
      },
  });

  const [existingImages, setExistingImages] = useState<string[]>(property.imageUrls || []);
  const [newImageFiles, setNewImageFiles] = useState<FileList | null>(null);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-8">
        
        <Card>
          <CardHeader><CardTitle className="text-xl">Property Address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
              <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (<FormItem><FormLabel>Property Name / Number</FormLabel><FormControl><Input placeholder="e.g., The Coppice, Flat 3b" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="address.street" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="e.g., 123 Main Street" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="address.city" render={({ field }) => (<FormItem><FormLabel>City / Town</FormLabel><FormControl><Input placeholder="e.g., London" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address.county" render={({ field }) => (<FormItem><FormLabel>County (Optional)</FormLabel><FormControl><Input placeholder="e.g., Greater London" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="address.postcode" render={({ field }) => (<FormItem><FormLabel>Postcode</FormLabel><FormControl><Input placeholder="e.g., SW1A 0AA" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl">Property Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="propertyType" render={({ field }) => (<FormItem><FormLabel>Property Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl><SelectContent>{[ 'House', 'Flat', 'Bungalow', 'Maisonette', 'Studio', 'HMO', ].map((type) => (<SelectItem key={type} value={type}> {type} </SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent>{['Vacant', 'Occupied', 'Under Maintenance'].map( (status) => (<SelectItem key={status} value={status}> {status} </SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="bedrooms" render={({ field }) => (<FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="bathrooms" render={({ field }) => (<FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input type="number" min="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader><CardTitle className="text-xl">Property Photos</CardTitle></CardHeader>
            <CardContent>
                {existingImages.length > 0 && !newImageFiles && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        {existingImages.map(url => <Image key={url} src={url} alt="Property photo" width={100} height={100} className="rounded-md object-cover aspect-square"/>)}
                    </div>
                )}
                <FormField control={form.control} name="images" render={({ field }) => (
                    <FormItem>
                        <FormLabel>{existingImages.length > 0 ? 'Upload New Photos (replaces old ones)' : 'Upload Photos'}</FormLabel>
                        <FormControl>
                            <Button asChild variant="outline" className="w-full cursor-pointer">
                                <label htmlFor="photos-upload">
                                <Upload className="mr-2 h-4 w-4" />
                                Choose Files
                                <Input
                                    id="photos-upload"
                                    type="file"
                                    multiple
                                    className="sr-only"
                                    onChange={(e) => {
                                        field.onChange(e.target.files);
                                        setNewImageFiles(e.target.files);
                                    }}
                                />
                                </label>
                            </Button>
                        </FormControl>
                        <FormMessage />
                        {newImageFiles && newImageFiles.length > 0 && (
                            <div className="text-sm text-muted-foreground pt-2">
                                <p>Selected: {Array.from(newImageFiles).map(f => f.name).join(', ')}</p>
                            </div>
                        )}
                    </FormItem>
                )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-xl">Tenancy &amp; Financials (Optional)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (<FormItem><FormLabel>Monthly Rent (£)</FormLabel><FormControl><Input type="text" inputMode="decimal" placeholder="0.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (<FormItem><FormLabel>Deposit Amount (£)</FormLabel><FormControl><Input type="text" inputMode="decimal" placeholder="0.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (<FormItem><FormLabel>Deposit Protection Scheme</FormLabel><FormControl><Input placeholder="e.g., DPS, MyDeposits" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-xl">Notes</CardTitle></CardHeader>
          <CardContent><FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Any additional notes about the property..." className="resize-none" rows={5} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/></CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild><Link href={`/dashboard/properties/${property.id}`}>Cancel</Link></Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}

// This is the main page component that controls data fetching and state.
export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;
  
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoize the document reference to prevent re-fetching on every render
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, user, propertyId]);
  
  // Use the useDoc hook to fetch the data
  const { data: property, isLoading, error } = useDoc(propertyRef);

  async function onSubmit(data: PropertyFormValues) {
    if (!firestore || !storage || !propertyId || !user) {
        toast({ variant: "destructive", title: "Error", description: "Database connection not found or user not authenticated." });
        return;
    };
    if (property?.ownerId !== user.uid) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not own this property." });
        return;
    }

    setIsSubmitting(true);
    const docRef = doc(firestore, 'properties', propertyId);

    try {
      let imageUrls = property.imageUrls || [];
      if (data.images && data.images.length > 0) {
          imageUrls = []; // Replace old photos
          for (const file of Array.from(data.images)) {
              const uniqueFileName = `${Date.now()}-${file.name}`;
              const fileStorageRef = storageRef(storage, `properties/${user.uid}/${propertyId}/${uniqueFileName}`);
              const uploadResult = await uploadBytes(fileStorageRef, file);
              imageUrls.push(await getDownloadURL(uploadResult.ref));
          }
      }
      
      const { images, ...formData } = data;
      await setDoc(docRef, { ...formData, ownerId: user.uid, imageUrls: imageUrls }, { merge: true });

      toast({ title: "Property Updated", description: "Your property details have been saved successfully." });
      router.push(`/dashboard/properties`);
    } catch (e) {
      console.error("Error updating property:", e);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not save your changes. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Render states
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || (property && user && property.ownerId !== user.uid)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="text-center">
            <h3 className="text-xl font-semibold">Error Loading Property</h3>
            <p className="text-sm text-muted-foreground">{error?.message || "You don't have permission to edit this property."}</p>
        </div>
        <Button asChild><Link href="/dashboard/properties">Return to Properties</Link></Button>
      </div>
    );
  }

  if (!property) {
    return (
        <div className="text-center py-10">
          <h3 className="text-xl font-semibold">Property Not Found</h3>
          <Button asChild variant="link"><Link href="/dashboard/properties">Return to Properties</Link></Button>
        </div>
    );
  }

  return (
      <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Property</CardTitle>
        <CardDescription>
          Update the details for your property. Click save when you're done.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EditPropertyForm property={property} onFormSubmit={onSubmit} isSubmitting={isSubmitting} />
      </CardContent>
    </Card>
  )
}

    