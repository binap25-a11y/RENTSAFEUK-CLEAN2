'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
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
    const [pageIsLoading, setPageIsLoading] = useState(true);

    const form = useForm<PropertyFormValues>({
        resolver: zodResolver(propertySchema),
        defaultValues: {
            address: { nameOrNumber: '', street: '', city: '', county: '', postcode: '' },
            bedrooms: 0,
            bathrooms: 0,
            notes: '',
            tenancy: { monthlyRent: undefined, depositAmount: undefined, depositScheme: '' },
        },
    });

    useEffect(() => {
        // Wait for services and user to be available
        if (isUserLoading || !firestore) {
            return;
        }

        // If auth check is done and there's no user, stop.
        if (!user) {
            setError("Authentication error. Please log in again.");
            setPageIsLoading(false);
            return;
        }

        const fetchAndSetProperty = async () => {
            try {
                const propertyDocRef = doc(firestore, 'properties', propertyId);
                const propertySnap = await getDoc(propertyDocRef);

                if (!propertySnap.exists()) {
                    setError("Property not found.");
                    return;
                }

                const propertyData = propertySnap.data() as PropertyData;
                
                // This is a critical authorization check.
                if (propertyData.ownerId !== user.uid) {
                    setError("You do not have permission to edit this property.");
                    return;
                }

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
                form.reset(sanitizedData);
            } catch (e: any) {
                console.error("Failed to load property:", e);
                setError("An error occurred while loading the property data.");
            } finally {
                setPageIsLoading(false);
            }
        };

        fetchAndSetProperty();

    }, [isUserLoading, user, firestore, propertyId, form]);

    async function onSubmit(data: PropertyFormValues) {
        if (!user || !firestore) return;
        
        setIsSubmitting(true);
        try {
            const propertyDocRef = doc(firestore, 'properties', propertyId);
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

    if (pageIsLoading) {
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
                        <AlertTriangle /> Error
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
