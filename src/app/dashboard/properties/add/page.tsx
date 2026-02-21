
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';

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
} from '@/firebase';
import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { Loader2, Wand2, ShieldAlert } from 'lucide-react';

const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;

const propertySchema = z.object({
  address: z.object({
    nameOrNumber: z.string().optional(),
    street: z.string().min(3, 'Please enter a street address.'),
    city: z.string().min(2, 'Please enter a city or town.'),
    county: z.string().optional(),
    postcode: z.string().regex(ukPostcodeRegex, 'Please enter a valid UK postcode (e.g. SW1A 1AA).'),
  }),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  bedrooms: z.coerce.number().min(0, 'Bedrooms cannot be negative'),
  bathrooms: z.coerce.number().min(0, 'Bathrooms cannot be negative'),
  notes: z.string().optional(),
  purchasePrice: z.coerce.number().min(0, 'Price cannot be negative').optional(),
  currentValuation: z.coerce.number().min(0, 'Valuation cannot be negative').optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().min(0, 'Rent cannot be negative').optional(),
    depositAmount: z.coerce.number().min(0, 'Deposit cannot be negative').optional(),
    depositScheme: z.string().optional(),
  }).optional(),
}).refine(data => {
    if (!data.tenancy?.depositAmount || data.tenancy.depositAmount <= 0) {
        return true;
    }
    // Only validate depositScheme if a depositAmount is actually entered.
    return !!data.tenancy.depositScheme?.trim();
}, {
  message: "Deposit scheme is required if a deposit amount is entered.",
  path: ["tenancy", "depositScheme"]
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
        // UNIQUENESS CHECK: Street and Postcode
        const duplicateQuery = query(
            collection(firestore, 'properties'),
            where('ownerId', '==', user.uid),
            where('address.street', '==', data.address.street),
            where('address.postcode', '==', data.address.postcode),
            where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
            limit(1)
        );
        const duplicateSnap = await getDocs(duplicateQuery);

        if (!duplicateSnap.empty) {
            toast({
                variant: 'destructive',
                title: 'Duplicate Property',
                description: 'A property with this street and postcode already exists in your active portfolio.',
            });
            setIsSubmitting(false);
            return;
        }

        const propertyData = {
            ownerId: user.uid,
            ...JSON.parse(JSON.stringify(data)),
        };

        const propertiesCollection = collection(firestore, 'properties');
        await addDoc(propertiesCollection, propertyData);
        
        toast({ title: 'Property Added', description: 'The property has been added to your portfolio.' });
        router.push('/dashboard/properties');
    } catch (serverError: any) {
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save property. Please try again.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline text-3xl">Add New Property</CardTitle>
        <CardDescription>Onboard a new property into your management system.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader><CardTitle className="text-xl font-headline">Address</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                 <FormField control={form.control} name="address.street" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input placeholder="e.g. 12 High Street" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="address.city" render={({ field }) => (<FormItem><FormLabel>City / Town</FormLabel><FormControl><Input placeholder="e.g. London" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="address.postcode" render={({ field }) => (<FormItem><FormLabel>Postcode</FormLabel><FormControl><Input placeholder="e.g. W1A 1AA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl font-headline">Investment & Tenancy</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (<FormItem><FormLabel>Purchase Price (£)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="currentValuation" render={({ field }) => (<FormItem><FormLabel>Current Valuation (£)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <div className="pt-4 border-t space-y-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-primary" />
                        Deposit & Compliance
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (<FormItem><FormLabel>Security Deposit Amount (£)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (<FormItem><FormLabel>Protection Scheme Name</FormLabel><FormControl><Input placeholder="e.g. DPS, TDS, MyDeposits" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl font-headline">Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="propertyType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{[ 'House', 'Flat', 'Bungalow', 'Maisonette', 'Studio', 'HMO', ].map((type) => (<SelectItem key={type} value={type}> {type} </SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{['Vacant', 'Occupied', 'Under Maintenance'].map( (status) => (<SelectItem key={status} value={status}> {status} </SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="bedrooms" render={({ field }) => (<FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="bathrooms" render={({ field }) => (<FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-headline">Description</CardTitle>
                <Button type="button" variant="outline" size="sm" disabled>
                  <Wand2 className="mr-2 h-4 w-4" /> AI Description (Unavailable)
                </Button>
              </CardHeader>
              <CardContent><FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="Enter a description for the property..." className="resize-none" rows={8} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/></CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" asChild><Link href="/dashboard/properties">Cancel</Link></Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Property'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
