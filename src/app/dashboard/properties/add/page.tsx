'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import Image from 'next/image';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useStorage } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { PlaceHolderImages } from '@/lib/placeholder-images';

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

export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const [postcode, setPostcode] = useState('');
  const [foundAddresses, setFoundAddresses] = useState<string[]>([]);
  const [addressLookupStatus, setAddressLookupStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      bedrooms: 1,
      bathrooms: 1,
      status: 'Vacant',
      address: '',
    },
  });

  const handleFindAddress = async () => {
    if (!postcode) {
        toast({ variant: 'destructive', title: 'Postcode required', description: 'Please enter a postcode to find an address.' });
        return;
    }
    setAddressLookupStatus('loading');
    setFoundAddresses([]);
    form.setValue('address', ''); // Clear address field
    try {
        const response = await fetch(`/api/postcode?postcode=${encodeURIComponent(postcode)}`);
        if (!response.ok) throw new Error('Failed to fetch addresses');

        const data = await response.json();
        if (data.addresses && data.addresses.length > 0) {
            setFoundAddresses(data.addresses);
            setAddressLookupStatus('found');
        } else {
            setAddressLookupStatus('not_found');
        }
    } catch (error) {
        console.error("Error finding address:", error);
        setAddressLookupStatus('error');
    }
  };

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
      let imageUrl = PlaceHolderImages.find(p => p.id === 'property-placeholder')?.imageUrl || `https://picsum.photos/seed/${Math.random()}/800/500`;
      const imageFile = data.imageFile?.[0];

      if (imageFile) {
        const uniqueFileName = `${Date.now()}-${imageFile.name}`;
        const fileStorageRef = storageRef(storage, `properties/${user.uid}/${uniqueFileName}`);
        const uploadResult = await uploadBytes(fileStorageRef, imageFile);
        imageUrl = await getDownloadURL(uploadResult.ref);
      }
      
      const { imageFile: _, ...formData } = data;

      const newProperty = {
        ...formData,
        ownerId: user.uid,
        imageUrl,
      };

      const propertiesCollection = collection(firestore, 'properties');
      await addDocumentNonBlocking(propertiesCollection, newProperty);
      
      toast({
        title: 'Property Saved',
        description: 'The new property has been added to your portfolio.',
      });
      router.push('/dashboard/properties');
    } catch (error) {
        console.error('Failed to add property', error);
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'There was an error saving the property. Please try again.',
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
                <div className="space-y-2">
                    <Label htmlFor="postcode">Find by Postcode</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input id="postcode" placeholder="e.g., SW1A 0AA" className="sm:w-1/3" value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} />
                        <Button type="button" onClick={handleFindAddress} disabled={addressLookupStatus === 'loading'}>
                            {addressLookupStatus === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Find Address
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Uses getAddress.io. Requires an API key in your .env file.</p>
                </div>

                {addressLookupStatus === 'found' && (
                    <FormItem>
                        <FormLabel>Select Address</FormLabel>
                        <Select onValueChange={(value) => form.setValue('address', value)}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an address from the list" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {foundAddresses.map((addr, index) => (
                                    <SelectItem key={index} value={addr}>{addr}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )}

                {(addressLookupStatus === 'not_found' || addressLookupStatus === 'error') && (
                    <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md border">
                        {addressLookupStatus === 'not_found'
                            ? "No addresses found for that postcode. Please enter the full address manually below."
                            : "Could not fetch addresses. Please check the postcode or enter the address manually."
                        }
                    </div>
                )}
                
                <div className="pt-2">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">
                            Or
                            </span>
                        </div>
                    </div>
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enter Full Address Manually</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Select an address above or enter one manually." {...field} />
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
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="bathrooms" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bathrooms</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
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
                      {imagePreview && <Image src={imagePreview} alt="Image preview" width={200} height={125} className="mt-2 rounded-md object-cover" />}
                      <FormControl>
                         <Button asChild className="w-full cursor-pointer mt-2" variant="outline">
                            <label htmlFor="image-upload">
                              <Upload className="mr-2 h-4 w-4" />
                              Upload an Image
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
                <CardTitle className="text-xl">Tenancy & Financials (Optional)</CardTitle>
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
                            <Input type="number" placeholder="1200" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} />
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
                            <Input type="number" placeholder="1500" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} />
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
