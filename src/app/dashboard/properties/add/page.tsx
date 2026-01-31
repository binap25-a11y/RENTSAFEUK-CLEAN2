
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useStorage } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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
  imageFile: z.custom<FileList>().optional(),
  notes: z.string().optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().optional(),
    depositAmount: z.coerce.number().optional(),
    depositScheme: z.string().optional(),
  }).optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      bedrooms: 0,
      bathrooms: 0,
      status: 'Vacant',
      address: {
        nameOrNumber: '',
        street: '',
        city: '',
        county: '',
        postcode: '',
      },
      notes: '',
      tenancy: {
        monthlyRent: undefined,
        depositAmount: undefined,
        depositScheme: '',
      },
    },
  });

  async function onSubmit(data: PropertyFormValues) {
    if (!user || !firestore || !storage) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to add a property.',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const defaultPlaceholder = PlaceHolderImages.find(p => p.id === 'property-placeholder');
      let finalImageUrl = defaultPlaceholder?.imageUrl || '';

      if (data.imageFile && data.imageFile.length > 0) {
        const file = data.imageFile[0];
        const uniqueFileName = `${Date.now()}-${file.name}`;
        const fileStorageRef = storageRef(storage, `properties/${user.uid}/${uniqueFileName}`);
        const uploadResult = await uploadBytes(fileStorageRef, file);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      }
      
      const propertyData: { [key: string]: any } = {
        address: data.address,
        propertyType: data.propertyType,
        status: data.status,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        notes: data.notes,
        tenancy: data.tenancy,
        imageUrl: finalImageUrl,
        ownerId: user.uid,
      };

      // Remove undefined fields from tenancy to avoid Firestore errors
      if (propertyData.tenancy) {
        if (propertyData.tenancy.monthlyRent === undefined) delete propertyData.tenancy.monthlyRent;
        if (propertyData.tenancy.depositAmount === undefined) delete propertyData.tenancy.depositAmount;
        if (propertyData.tenancy.depositScheme === undefined || propertyData.tenancy.depositScheme === '') delete propertyData.tenancy.depositScheme;
        if (Object.keys(propertyData.tenancy).length === 0) {
          delete propertyData.tenancy;
        }
      }
      if (propertyData.notes === undefined || propertyData.notes === '') delete propertyData.notes;
      
      await addDoc(collection(firestore, 'properties'), propertyData);

      toast({
        title: 'Property Added',
        description: 'The new property has been added to your portfolio.',
      });
      router.push('/dashboard/properties');

    } catch (error: any) {
        console.error('Failed to add property', error);
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: error.message || 'There was an error saving the property. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Add New Property</CardTitle>
        <CardDescription>
          Fill in the details below to add a new property to your portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Property Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <FormField
                    control={form.control}
                    name="address.nameOrNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Property Name / Number</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., The Coppice, Flat 3b" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 123 Main Street" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="address.city"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>City / Town</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., London" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="address.county"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>County</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Greater London" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
                 <FormField
                    control={form.control}
                    name="address.postcode"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Postcode</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., SW1A 0AA" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[ 'House', 'Flat', 'Bungalow', 'Maisonette', 'Studio', 'HMO', ].map((type) => (
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        className="aspect-video w-full rounded-lg border-2 border-dashed bg-muted bg-cover bg-center"
                        style={{ backgroundImage: imagePreview ? `url(${imagePreview})` : 'none' }}
                      >
                        {!imagePreview && (
                            <div className="flex items-center justify-center h-full">
                                <span className="text-muted-foreground">Image Preview</span>
                            </div>
                        )}
                      </div>
                      <FormControl>
                        <Button
                          asChild
                          className="w-full cursor-pointer mt-2"
                          variant="outline"
                        >
                          <label htmlFor="image-upload">
                            <Upload className="mr-2 h-4 w-4" />
                            {imagePreview ? 'Change Image' : 'Upload an Image'}
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
                                  setImagePreview(null);
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
                <CardTitle className="text-xl">Tenancy &amp; Financials (Optional)</CardTitle>
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
                            <Input type="number" placeholder="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} />
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
                            <Input type="number" placeholder="0" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''}/>
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
                        <Input placeholder="e.g., DPS, MyDeposits" {...field} value={field.value ?? ''}/>
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
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
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
                Save Property
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
