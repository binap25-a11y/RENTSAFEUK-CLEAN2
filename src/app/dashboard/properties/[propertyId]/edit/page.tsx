'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Loader2, AlertTriangle } from 'lucide-react';

// Zod schema for form validation
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

// This is the Firestore data structure. Note that it might have missing fields.
interface PropertyData {
  ownerId: string;
  address?: {
    nameOrNumber?: string;
    street?: string;
    city?: string;
    county?: string;
    postcode?: string;
  };
  propertyType?: string;
  status?: string;
  bedrooms?: number;
  bathrooms?: number;
  notes?: string;
  tenancy?: {
    monthlyRent?: number;
    depositAmount?: number;
    depositScheme?: string;
  }
}

export default function EditPropertyPage() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.propertyId as string;
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PropertyFormValues>({
        resolver: zodResolver(propertySchema),
        defaultValues: { // Start with complete default values
            address: { nameOrNumber: '', street: '', city: '', county: '', postcode: '' },
            propertyType: '',
            status: 'Vacant',
            bedrooms: 0,
            bathrooms: 0,
            notes: '',
            tenancy: { monthlyRent: undefined, depositAmount: undefined, depositScheme: '' },
        }
    });

    const { reset } = form;

    // The key to stability: a memoized document reference.
    // This reference is created only once and reused, preventing the infinite loop.
    const propertyDocRef = useMemoFirebase(() => {
        if (!firestore || !propertyId) return null;
        return doc(firestore, 'properties', propertyId);
    }, [firestore, propertyId]);

    // useDoc hook subscribes to the stable reference.
    const { data: propertyData, isLoading: isPropertyLoading, error: propertyError } = useDoc<PropertyData>(propertyDocRef);
    
    // This effect runs ONLY when the data (or user/reset) actually changes.
    useEffect(() => {
        if (propertyError) {
            setError(propertyError.message);
        } else if (propertyData) {
            // Check for permissions
            if (user && propertyData.ownerId !== user.uid) {
                setError("You do not have permission to view this property.");
                return;
            }

            // Sanitize the data from Firestore to ensure it has all required fields for the form.
            const sanitizedData: PropertyFormValues = {
                address: {
                    nameOrNumber: propertyData.address?.nameOrNumber ?? '',
                    street: propertyData.address?.street ?? '',
                    city: propertyData.address?.city ?? '',
                    county: propertyData.address?.county ?? '',
                    postcode: propertyData.address?.postcode ?? '',
                },
                propertyType: propertyData.propertyType ?? '',
                status: propertyData.status ?? 'Vacant',
                bedrooms: propertyData.bedrooms ?? 0,
                bathrooms: propertyData.bathrooms ?? 0,
                notes: propertyData.notes ?? '',
                tenancy: {
                    monthlyRent: propertyData.tenancy?.monthlyRent,
                    depositAmount: propertyData.tenancy?.depositAmount,
                    depositScheme: propertyData.tenancy?.depositScheme ?? '',
                },
            };
            
            // Safely populate the form with the sanitized data.
            reset(sanitizedData);
        }
    }, [propertyData, propertyError, user, reset]);
    

    async function onSubmit(data: PropertyFormValues) {
        if (!user || !firestore || !propertyDocRef) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Authentication or database service is missing.' });
            return;
        }

        setIsSubmitting(true);
        try {
            await updateDoc(propertyDocRef, data);
            toast({ title: 'Property Updated', description: 'The property details have been successfully updated.' });
            router.push('/dashboard/properties');
        } catch (error: any) {
            console.error('Failed to update property', error);
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'There was an error updating the property.' });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const isLoading = isPropertyLoading || isUserLoading;

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (error) {
        return (
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle /> Error Loading Property
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{error}</p>
                    <Button asChild variant="link" className="mt-4 px-0">
                        <Link href="/dashboard/properties">Return to Properties</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }
    
    if (!propertyData && !isLoading) {
        return (
             <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle /> Property Not Found
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>The requested property could not be found.</p>
                    <Button asChild variant="link" className="mt-4 px-0">
                        <Link href="/dashboard/properties">Return to Properties</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Edit Property</CardTitle>
                <CardDescription>Update the details for your property.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Card>
                            <CardHeader><CardTitle className="text-xl">Property Address</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => ( <FormItem> <FormLabel>Property Name / Number</FormLabel> <FormControl> <Input placeholder="e.g., The Coppice, Flat 3b" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                                <FormField control={form.control} name="address.street" render={({ field }) => ( <FormItem> <FormLabel>Street Address</FormLabel> <FormControl> <Input placeholder="e.g., 123 Main Street" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="address.city" render={({ field }) => ( <FormItem> <FormLabel>City / Town</FormLabel> <FormControl> <Input placeholder="e.g., London" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                                    <FormField control={form.control} name="address.county" render={({ field }) => ( <FormItem> <FormLabel>County (Optional)</FormLabel> <FormControl> <Input placeholder="e.g., Greater London" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
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
                            <CardHeader><CardTitle className="text-xl">Tenancy &amp; Financials (Optional)</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => ( <FormItem> <FormLabel>Monthly Rent (£)</FormLabel> <FormControl> <Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /> </FormControl> <FormMessage /> </FormItem> )} />
                                    <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => ( <FormItem> <FormLabel>Deposit Amount (£)</FormLabel> <FormControl> <Input type="number" placeholder="0" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} /> </FormControl> <FormMessage /> </FormItem> )} />
                                </div>
                                <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => ( <FormItem> <FormLabel>Deposit Protection Scheme</FormLabel> <FormControl> <Input placeholder="e.g., DPS, MyDeposits" {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-xl">Notes</CardTitle></CardHeader>
                            <CardContent>
                                <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem> <FormControl> <Textarea placeholder="Any additional notes about the property..." className="resize-none" rows={5} {...field} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )} />
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
