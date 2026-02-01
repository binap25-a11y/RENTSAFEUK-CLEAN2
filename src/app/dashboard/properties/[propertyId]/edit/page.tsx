'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc, DocumentData } from 'firebase/firestore';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';

// Schema for the form
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

// Property interface from Firestore
interface Property extends DocumentData {
    id: string;
    ownerId: string;
}

export default function EditPropertyPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    
    const [propertyData, setPropertyData] = useState<Property | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<PropertyFormValues>({
        resolver: zodResolver(propertySchema),
        defaultValues: {
            address: { nameOrNumber: '', street: '', city: '', county: '', postcode: '' },
            propertyType: '',
            status: '',
            bedrooms: 0,
            bathrooms: 0,
            notes: '',
            tenancy: { monthlyRent: undefined, depositAmount: undefined, depositScheme: '' },
        },
    });

    useEffect(() => {
        if (!firestore || !propertyId || !user) {
            setIsLoading(false);
            setError("Could not retrieve required information to fetch property.");
            return;
        }

        const fetchProperty = async () => {
            try {
                const propertyRef = doc(firestore, 'properties', propertyId);
                const propertySnap = await getDoc(propertyRef);

                if (propertySnap.exists()) {
                    const data = propertySnap.data() as Property;
                    
                    if (data.ownerId !== user.uid) {
                        setError("You do not have permission to edit this property.");
                        setIsLoading(false);
                        return;
                    }
                    
                    const loadedData = { id: propertySnap.id, ...data };
                    setPropertyData(loadedData);
                    
                    form.reset({
                        address: {
                            nameOrNumber: data.address?.nameOrNumber ?? '',
                            street: data.address?.street ?? '',
                            city: data.address?.city ?? '',
                            county: data.address?.county ?? '',
                            postcode: data.address?.postcode ?? '',
                        },
                        propertyType: data.propertyType ?? '',
                        status: data.status ?? '',
                        bedrooms: data.bedrooms ?? 0,
                        bathrooms: data.bathrooms ?? 0,
                        notes: data.notes ?? '',
                        tenancy: {
                            monthlyRent: data.tenancy?.monthlyRent ?? undefined,
                            depositAmount: data.tenancy?.depositAmount ?? undefined,
                            depositScheme: data.tenancy?.depositScheme ?? '',
                        },
                    });
                } else {
                    setError("Property not found.");
                }
            } catch (e: any) {
                console.error("Error fetching property: ", e);
                setError(e.message || "An unexpected error occurred while fetching data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchProperty();
    }, [firestore, propertyId, user, form.reset]);

    async function handleSaveChanges(data: PropertyFormValues) {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Authentication or database service is missing.' });
            return;
        }

        const propertyRef = doc(firestore, 'properties', propertyId);

        try {
            await updateDoc(propertyRef, data);
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
                description: error.message || 'There was an error updating the property.',
            });
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-10">
                <p className="text-destructive">{error}</p>
                <Button asChild variant="link"><Link href="/dashboard/properties">Return to Properties</Link></Button>
            </div>
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
                    <form onSubmit={form.handleSubmit(handleSaveChanges)} className="space-y-8">
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
                                    <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => ( <FormItem> <FormLabel>Monthly Rent (£)</FormLabel> <FormControl> <Input type="number" placeholder="1200" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )} />
                                    <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => ( <FormItem> <FormLabel>Deposit Amount (£)</FormLabel> <FormControl> <Input type="number" placeholder="1500" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} /> </FormControl> <FormMessage /> </FormItem> )} />
                                </div>
                                <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => ( <FormItem> <FormLabel>Deposit Protection Scheme</FormLabel> <FormControl> <Input placeholder="e.g., DPS, MyDeposits" {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle className="text-xl">Notes (Optional)</CardTitle></CardHeader>
                            <CardContent>
                                <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem> <FormControl> <Textarea placeholder="Any additional notes about the property..." className="resize-none" rows={5} {...field} /> </FormControl> <FormMessage /> </FormItem> )} />
                            </CardContent>
                        </Card>

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" asChild>
                                <Link href="/dashboard/properties">Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
    