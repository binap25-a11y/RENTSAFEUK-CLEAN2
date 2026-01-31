'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useStorage, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload } from 'lucide-react';

const propertySchema = z.object({
  address: z.string().min(5, 'Address is too short'),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  bedrooms: z.coerce.number().min(0, 'Cannot be negative'),
  bathrooms: z.coerce.number().min(0, 'Cannot be negative'),
  imageFile: z.custom<FileList>().optional(),
  notes: z.string().optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().optional(),
    depositAmount: z.coerce.number().optional(),
    depositScheme: z.string().optional(),
  }).optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

interface Property {
  address: string;
  propertyType: string;
  status: string;
  bedrooms: number;
  bathrooms: number;
  imageUrl?: string;
  notes?: string;
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
  const storage = useStorage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
  });

  const propertyRef = useMemoFirebase(() => {
      if (!firestore || !propertyId) return null;
      return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);

  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  useEffect(() => {
    if (property) {
      form.reset({
        ...property,
        bedrooms: property.bedrooms ?? 0,
        bathrooms: property.bathrooms ?? 0,
        notes: property.notes ?? '',
        tenancy: {
            monthlyRent: property.tenancy?.monthlyRent ?? undefined,
            depositAmount: property.tenancy?.depositAmount ?? undefined,
            depositScheme: property.tenancy?.depositScheme ?? '',
        }
      });
      if (property.imageUrl) {
        setImagePreview(property.imageUrl);
      }
    }
  }, [property, form]);

  async function onSubmit(data: PropertyFormValues) {
    if (!user || !firestore || !storage || !propertyId) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'An unexpected error occurred. Please try again.',
      });
      return;
    }
    setIsSubmitting(true);

    const propertyDataToSave: { [key: string]: any } = {
        address: data.address,
        propertyType: data.propertyType,
        status: data.status,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
    };
    
    if (data.notes) {
        propertyDataToSave.notes = data.notes;
    } else {
        propertyDataToSave.notes = '';
    }
    
    const tenancyData: { [key: string]: any } = {};
    if (data.tenancy) {
        if (data.tenancy.monthlyRent !== undefined && !isNaN(data.tenancy.monthlyRent)) {
            tenancyData.monthlyRent = data.tenancy.monthlyRent;
        }
        if (data.tenancy.depositAmount !== undefined && !isNaN(data.tenancy.depositAmount)) {
            tenancyData.depositAmount = data.tenancy.depositAmount;
        }
        if (data.tenancy.depositScheme) {
            tenancyData.depositScheme = data.tenancy.depositScheme;
        }
    }
     if (Object.keys(tenancyData).length > 0) {
        propertyDataToSave.tenancy = tenancyData;
    }

    try {
      let imageUrl = property?.imageUrl; 
      const imageFile = data.imageFile?.[0];
      if (imageFile) {
        const uniqueFileName = `${Date.now()}-${imageFile.name}`;
        const fileStorageRef = storageRef(storage, `properties/${user.uid}/${uniqueFileName}`);
        const uploadResult = await uploadBytes(fileStorageRef, imageFile);
        imageUrl = await getDownloadURL(uploadResult.ref);
      }
      propertyDataToSave.imageUrl = imageUrl;
      
      const propertyDocRef = doc(firestore, 'properties', propertyId);
      await updateDoc(propertyDocRef, propertyDataToSave);

      toast({
        title: 'Property Updated',
        description: 'The property details have been successfully updated.',
      });
      router.push('/dashboard/properties');
    } catch (error: any) {
      console.error('Failed to update property:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'There was an error updating the property. Please try again.',
      });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  if (isLoadingProperty) {
      return (
          <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
      );
  }
  
  if (!property) {
      return (
        <div className="text-center py-10">
          <p>Property not found.</p>
          <Button asChild variant="link">
            <Link href="/dashboard/properties">Return to Properties List</Link>
          </Button>
        </div>
      );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Property</CardTitle>
        <CardDescription>
          Update the details for your property at {property.address}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Address</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 123 Main St, London" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[ 'House', 'Flat', 'Bungalow', 'Maisonette', 'Studio', 'HMO' ].map((type) => (
                              <SelectItem key={type} value={type}> {type} </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {['Vacant', 'Occupied', 'Under Maintenance'].map( (status) => (
                                <SelectItem key={status} value={status}> {status} </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="bedrooms" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bedrooms</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="bathrooms" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bathrooms</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                    control={form.control}
                    name="imageFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Image</FormLabel>
                        <div
                            className="aspect-video w-full rounded-lg border-2 border-dashed bg-muted bg-contain bg-center bg-no-repeat"
                            style={{ backgroundImage: imagePreview ? `url(${imagePreview})` : 'none' }}
                        >
                            {!imagePreview && (
                                <div className="flex h-full w-full items-center justify-center">
                                    <span className="text-muted-foreground">Image Preview</span>
                                </div>
                            )}
                        </div>
                        <FormControl>
                           <Button asChild className="w-full cursor-pointer mt-2" variant="outline">
                              <label htmlFor="image-upload">
                                <Upload className="mr-2 h-4 w-4" />
                                {imagePreview ? 'Change Image' : 'Upload Image'}
                                <Input
                                  id="image-upload"
                                  type="file"
                                  className="sr-only"
                                  accept="image/png, image/jpeg, image/webp"
                                  onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                          field.onChange(e.target.files);
                                          setImagePreview(URL.createObjectURL(file));
                                      } else {
                                          field.onChange(null);
                                          setImagePreview(property?.imageUrl || null);
                                      }
                                  }}
                                />
                              </label>
                            </Button>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="text-xl">Tenancy &amp; Financials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="tenancy.monthlyRent"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Monthly Rent (£)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="1200" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''}/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="tenancy.depositAmount"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Deposit Amount (£)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="1500" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''}/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="tenancy.depositScheme"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Deposit Protection Scheme</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., DPS, MyDeposits" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea placeholder="Any additional notes about the property..." className="resize-none" rows={5} {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/properties">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
