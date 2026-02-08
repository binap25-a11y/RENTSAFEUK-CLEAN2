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
import {
  useUser,
  useFirestore,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Loader2, Wand2 } from 'lucide-react';
import { generatePropertyDescription } from '@/ai/flows/property-description-flow';

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
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleMagicDescription = async () => {
    const values = form.getValues();
    if (!values.propertyType || !values.address.city) {
      toast({
        variant: 'destructive',
        title: 'Missing Details',
        description: 'Please select a property type and enter at least the city to generate a description.',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const addressString = [values.address.street, values.address.city, values.address.postcode].filter(Boolean).join(', ');
      const result = await generatePropertyDescription({
        propertyType: values.propertyType,
        bedrooms: Number(values.bedrooms),
        bathrooms: Number(values.bathrooms),
        address: addressString,
        keyFeatures: values.notes,
      });

      form.setValue('notes', `${result.headline}\n\n${result.description}`);
      toast({
        title: 'Description Generated',
        description: 'AI has generated a professional listing for you.',
      });
    } catch (error) {
      console.error('Error generating description:', error);
      toast({
        variant: 'destructive',
        title: 'AI Error',
        description: 'Could not generate description. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  async function onSubmit(data: PropertyFormValues) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to add a property.',
      });
      return;
    }

    setIsSubmitting(true);

    const propertyData: { [key: string]: any } = {
      ownerId: user.uid,
      ...data,
    };

    if (!propertyData.notes) delete propertyData.notes;
    if (propertyData.tenancy) {
      if (propertyData.tenancy.monthlyRent === undefined) delete propertyData.tenancy.monthlyRent;
      if (propertyData.tenancy.depositAmount === undefined) delete propertyData.tenancy.depositAmount;
      if (!propertyData.tenancy.depositScheme) delete propertyData.tenancy.depositScheme;
      if (Object.keys(propertyData.tenancy).length === 0) delete propertyData.tenancy;
    }

    const propertiesCollection = collection(firestore, 'properties');

    addDoc(propertiesCollection, propertyData)
      .then(() => {
        toast({
          title: 'Property Added',
          description: 'The new property has been added to your portfolio.',
        });
        router.push('/dashboard/properties');
      })
      .catch((serverError: any) => {
        const permissionError = new FirestorePermissionError({
          path: propertiesCollection.path,
          operation: 'create',
          requestResourceData: propertyData,
        });
        errorEmitter.emit('permission-error', permissionError);

        console.error('Failed to add property', serverError);
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: serverError.message || 'There was an error saving the property. Please try again.',
        });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline text-3xl">Add New Property</CardTitle>
        <CardDescription>
          Fill in the details below to onboard a new property into your management system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Property Image Card is hidden for later use */}

            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-headline">Property Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <FormField
                    control={form.control}
                    name="address.nameOrNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Property Name / Number</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., The Coppice, Flat 3b" {...field} />
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
                                <Input placeholder="e.g., Greater London" {...field} />
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
                <CardTitle className="text-xl font-headline">Property Details</CardTitle>
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
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <CardTitle className="text-xl font-headline">Tenancy &amp; Financials (Optional)</CardTitle>
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
                            <Input type="text" inputMode="decimal" placeholder="0.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} />
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
                            <Input type="text" inputMode="decimal" placeholder="0.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''}/>
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xl font-headline">Notes & Description</CardTitle>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMagicDescription}
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  Magic Description
                </Button>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea placeholder="Any additional notes or generated listing description..." className="resize-none" rows={10} {...field} value={field.value ?? ''} />
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
