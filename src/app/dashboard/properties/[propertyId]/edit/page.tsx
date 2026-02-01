'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
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

// Firestore data type
interface PropertyData {
  ownerId: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
  propertyType: string;
  status: string;
  bedrooms: number;
  bathrooms: number;
  notes?: string;
  tenancy?: {
    monthlyRent?: number;
    depositAmount?: number;
    depositScheme?: string;
  };
}

// The Form component, now isolated from data fetching logic.
function EditPropertyForm({ propertyId, form }: { propertyId: string, form: UseFormReturn<PropertyFormValues> }) {
    const router = useRouter();
    const firestore = useFirestore();

    async function onSubmit(data: PropertyFormValues) {
        if (!firestore) return;
        
        try {
            const propertyDocRef = doc(firestore, 'properties', propertyId);
            await updateDoc(propertyDocRef, { ...data });
            toast({ title: 'Property Updated', description: 'The property details have been successfully updated.' });
            router.push('/dashboard/properties');
        } catch (error: any) {
            console.error('Failed to update property', error);
            toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'There was an error updating the property.' });
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
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Changes
                    </Button>
                </div>
            </form>
        </Form>
    );
}

// The main page component, now responsible only for data fetching and state management.
export default function EditPropertyPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const [pageState, setPageState] = useState<'loading' | 'error' | 'success'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const form = useForm<PropertyFormValues>({
        resolver: zodResolver(propertySchema),
    });

    useEffect(() => {
        if (isUserLoading) {
            return; // Wait until user authentication is resolved
        }
        if (!user) {
            setErrorMessage("You must be logged in to edit this page.");
            setPageState('error');
            return;
        }
        if (!firestore || !propertyId) {
            setErrorMessage("An unexpected error occurred. Required data is missing.");
            setPageState('error');
            return;
        }

        const fetchProperty = async () => {
            const propertyDocRef = doc(firestore, 'properties', propertyId);
            try {
                const docSnap = await getDoc(propertyDocRef);

                if (!docSnap.exists()) {
                    setErrorMessage("Property not found.");
                    setPageState('error');
                    return;
                }
                
                const data = docSnap.data() as PropertyData;

                if (data.ownerId !== user.uid) {
                    setErrorMessage("You do not have permission to edit this property.");
                    setPageState('error');
                    return;
                }

                // Set the form values here, once, after successful fetch.
                form.reset({
                    address: {
                        nameOrNumber: data.address?.nameOrNumber ?? '',
                        street: data.address?.street ?? '',
                        city: data.address?.city ?? '',
                        county: data.address?.county ?? '',
                        postcode: data.address?.postcode ?? '',
                    },
                    propertyType: data.propertyType ?? '',
                    status: data.status ?? 'Vacant',
                    bedrooms: data.bedrooms ?? 0,
                    bathrooms: data.bathrooms ?? 0,
                    notes: data.notes ?? '',
                    tenancy: {
                        monthlyRent: data.tenancy?.monthlyRent,
                        depositAmount: data.tenancy?.depositAmount,
                        depositScheme: data.tenancy?.depositScheme ?? '',
                    },
                });

                setPageState('success'); // Mark as success, which will trigger render of the form
            } catch (err: any) {
                console.error("Failed to fetch property", err);
                setErrorMessage(err.message || "An unexpected error occurred while fetching data.");
                setPageState('error');
            }
        };

        fetchProperty();
        // This effect should only run once when the component has the necessary data.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isUserLoading, user, firestore, propertyId]);

    if (pageState === 'loading') {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    if (pageState === 'error') {
        return (
             <Card className="max-w-2xl mx-auto">
                <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Error</CardTitle></CardHeader>
                <CardContent>
                    <p>{errorMessage}</p>
                    <Button asChild variant="link" className="mt-4 px-0"><Link href="/dashboard/properties">Return to Properties</Link></Button>
                </CardContent>
            </Card>
        );
    }

    // Only render the form when the page state is 'success'
    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Edit Property</CardTitle>
                <CardDescription>Update the details for your property.</CardDescription>
            </CardHeader>
            <CardContent>
                <EditPropertyForm propertyId={propertyId} form={form} />
            </CardContent>
        </Card>
    );
}
