'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Loader2 } from 'lucide-react';

// Schema for the form, which remains the same
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

interface Property extends PropertyFormValues {
    id: string;
    ownerId: string;
}

// A new, dedicated component for the form to ensure clean state management
function PropertyEditForm({ property }: { property: Property }) {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    // Use `values` to populate the form. This is the key fix that prevents infinite loops.
    values: {
        address: {
            nameOrNumber: property.address?.nameOrNumber ?? '',
            street: property.address?.street ?? '',
            city: property.address?.city ?? '',
            county: property.address?.county ?? '',
            postcode: property.address?.postcode ?? '',
        },
        propertyType: property.propertyType ?? '',
        status: property.status ?? '',
        bedrooms: property.bedrooms ?? 0,
        bathrooms: property.bathrooms ?? 0,
        notes: property.notes ?? '',
        tenancy: {
            monthlyRent: property.tenancy?.monthlyRent ?? undefined,
            depositAmount: property.tenancy?.depositAmount ?? undefined,
            depositScheme: property.tenancy?.depositScheme ?? '',
        },
    }
  });

  async function onSubmit(data: PropertyFormValues) {
    if (!user || !firestore || !property.id) {
      toast({ variant: 'destructive', title: 'Save Failed', description: 'Authentication or property ID is missing. Please try again.' });
      return;
    }
    
    if (property.ownerId !== user.uid) {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to edit this property.' });
        return;
    }

    setIsSubmitting(true);
    const propertyDocRef = doc(firestore, 'properties', property.id);

    try {
      await updateDoc(propertyDocRef, data);
      toast({
        title: 'Property Updated',
        description: 'The property details have been successfully updated.',
      });
      router.push('/dashboard/properties');
    } catch (error: any) {
      console.error('Failed to update property', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'There was an error updating the property. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader><CardTitle className="text-xl">Property Address</CardTitle></CardHeader>
            <CardContent className="space-y-4">
            <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => ( <FormItem> <FormLabel>Property Name / Number</FormLabel> <FormControl> <Input placeholder="e.g., The Coppice, Flat 3b" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
            <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem> <FormLabel>Street Address</FormLabel> <FormControl> <Input placeholder="e.g., 123 Main Street" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem> <FormLabel>City / Town</FormLabel> <FormControl> <Input placeholder="e.g., London" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="address.county" render={({ field }) => ( <FormItem> <FormLabel>County</FormLabel> <FormControl> <Input placeholder="e.g., Greater London" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
            </div>
            <FormField control={form.control} name="address.postcode" render={({ field }) => ( <FormItem> <FormLabel>Postcode</FormLabel> <FormControl> <Input placeholder="e.g., SW1A 0AA" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-xl">Property Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="propertyType" render={({ field }) => ( <FormItem> <FormLabel>Property Type</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select a type" /> </SelectTrigger> </FormControl> <SelectContent> {[ 'House', 'Flat', 'Bungalow', 'Maisonette', 'Studio', 'HMO' ].map((type) => ( <SelectItem key={type} value={type}> {type} </SelectItem> ))} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="status" render={({ field }) => ( <FormItem> <FormLabel>Status</FormLabel> <Select onValueChange={field.onChange} value={field.value}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select a status" /> </SelectTrigger> </FormControl> <SelectContent> {['Vacant', 'Occupied', 'Under Maintenance'].map( (status) => ( <SelectItem key={status} value={status}> {status} </SelectItem> ) )} </SelectContent> </Select> <FormMessage /> </FormItem> )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="bedrooms" render={({ field }) => ( <FormItem> <FormLabel>Bedrooms</FormLabel> <FormControl> <Input type="number" min="0" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="bathrooms" render={({ field }) => ( <FormItem> <FormLabel>Bathrooms</FormLabel> <FormControl> <Input type="number" min="0" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
            </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-xl">Tenancy &amp; Financials</CardTitle></CardHeader>
            <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => ( <FormItem> <FormLabel>Monthly Rent (£)</FormLabel> <FormControl> <Input type="number" placeholder="1200" {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => ( <FormItem> <FormLabel>Deposit Amount (£)</FormLabel> <FormControl> <Input type="number" placeholder="1500" {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )} />
            </div>
            <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => ( <FormItem> <FormLabel>Deposit Protection Scheme</FormLabel> <FormControl> <Input placeholder="e.g., DPS, MyDeposits" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
            </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle className="text-xl">Notes</CardTitle></CardHeader>
            <CardContent>
            <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem> <FormControl> <Textarea placeholder="Any additional notes about the property..." className="resize-none" rows={5} {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
            </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/properties">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
            </Button>
        </div>
      </form>
    </Form>
  );
}


// Main page component that handles data fetching and loading/error states
export default function EditPropertyPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();

  const propertyDocRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);

  const { data: propertyData, isLoading, error } = useDoc<Property>(propertyDocRef);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
        <div className="text-center py-10">
            <p className="text-destructive">Error loading property: {error.message}</p>
            <Button asChild variant="link">
              <Link href="/dashboard/properties">Return to Properties List</Link>
            </Button>
        </div>
    );
  }

  if (!propertyData) {
    return (
        <div className="text-center py-10">
            <p>Property not found.</p>
            <Button asChild variant="link">
              <Link href="/dashboard/properties">Return to Properties List</Link>
            </Button>
        </div>
    )
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Property</CardTitle>
        <CardDescription>Update the details for your property.</CardDescription>
      </CardHeader>
      <CardContent>
        <PropertyEditForm property={propertyData} />
      </CardContent>
    </Card>
  );
}
