'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, AlertTriangle } from 'lucide-react';

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

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;
  
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Memoize the document reference to prevent re-fetching on every render
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, user, propertyId]);
  
  const { data: property, isLoading, error } = useDoc(propertyRef);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      address: {
        nameOrNumber: '',
        street: '',
        city: '',
        county: '',
        postcode: '',
      },
      bedrooms: 0,
      bathrooms: 0,
      status: 'Vacant',
      notes: '',
      tenancy: {
        monthlyRent: undefined,
        depositAmount: undefined,
        depositScheme: '',
      },
    },
  });

  useEffect(() => {
    if (property) {
      form.reset({
        address: property.address || {},
        propertyType: property.propertyType,
        status: property.status,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        notes: property.notes || '',
        tenancy: property.tenancy || {},
      });
    }
  }, [property, form]);


  async function onSubmit(data: PropertyFormValues) {
    if (!firestore || !propertyId || !user) {
        toast({ variant: "destructive", title: "Error", description: "Database connection not found or user not authenticated." });
        return;
    };
    
    if (property?.ownerId !== user.uid) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to modify this property." });
        return;
    }

    setIsSubmitting(true);
    const docRef = doc(firestore, 'properties', propertyId);

    // Sanitize data: remove undefined values and clean up optional tenancy sub-object
    const cleanedData = JSON.parse(JSON.stringify(data));
    
    if (cleanedData.tenancy) {
      if (cleanedData.tenancy.monthlyRent === null || cleanedData.tenancy.monthlyRent === undefined) delete cleanedData.tenancy.monthlyRent;
      if (cleanedData.tenancy.depositAmount === null || cleanedData.tenancy.depositAmount === undefined) delete cleanedData.tenancy.depositAmount;
      if (!cleanedData.tenancy.depositScheme) delete cleanedData.tenancy.depositScheme;
      if (Object.keys(cleanedData.tenancy).length === 0) delete cleanedData.tenancy;
    }

    try {
      // Use setDoc with merge: true to perform a non-destructive update
      await setDoc(docRef, { ...cleanedData, ownerId: user.uid }, { merge: true });

      toast({ title: "Property Updated", description: "Your property details have been saved successfully." });
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (e) {
      console.error("Error updating property:", e);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not save your changes. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

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
        <div className="text-center px-4">
            <h3 className="text-xl font-semibold">Access Denied or Error</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{error?.message || "You don't have permission to edit this property record."}</p>
        </div>
        <Button asChild><Link href="/dashboard/properties">Return to Properties</Link></Button>
      </div>
    );
  }

  if (!property) {
    return (
        <div className="text-center py-20">
          <Home className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
          <h3 className="text-xl font-semibold">Property Not Found</h3>
          <p className="text-sm text-muted-foreground mb-6">The property you are trying to edit does not exist or has been removed.</p>
          <Button asChild variant="outline"><Link href="/dashboard/properties">Return to Properties</Link></Button>
        </div>
    );
  }

  return (
      <Card className="max-w-4xl mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Edit Property</CardTitle>
        <CardDescription>
          Update the location and details for your portfolio property.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <Card className="border-none shadow-none bg-muted/30">
              <CardHeader><CardTitle className="text-lg font-headline">Property Address</CardTitle></CardHeader>
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

            <Card className="border-none shadow-none bg-muted/30">
              <CardHeader><CardTitle className="text-lg font-headline">Basic Details</CardTitle></CardHeader>
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

            <Card className="border-none shadow-none bg-muted/30">
                <CardHeader><CardTitle className="text-lg font-headline">Tenancy &amp; Financials (Optional)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Rent (£)</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            inputMode="decimal" 
                            placeholder="0.00" 
                            {...field} 
                            onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} 
                            value={field.value ?? ''} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit Amount (£)</FormLabel>
                        <FormControl>
                          <Input 
                            type="text" 
                            inputMode="decimal" 
                            placeholder="0.00" 
                            {...field} 
                            onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} 
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit Protection Scheme</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., DPS, MyDeposits" {...field} value={field.value ?? ''}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                </CardContent>
            </Card>

            <Card className="border-none shadow-none bg-muted/30">
              <CardHeader><CardTitle className="text-lg font-headline">Additional Notes</CardTitle></CardHeader>
              <CardContent><FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Any additional notes about the property..." className="resize-none" rows={5} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/></CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" asChild><Link href={`/dashboard/properties/${propertyId}`}>Cancel</Link></Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving Changes...
                  </>
                ) : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
