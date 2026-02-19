
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
  purchasePrice: z.coerce.number().optional(),
  currentValuation: z.coerce.number().optional(),
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
      toast({ variant: 'destructive', title: 'Missing Details' });
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
      toast({ title: 'Description Generated' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'AI Error' });
    } finally {
      setIsGenerating(false);
    }
  };

  async function onSubmit(data: PropertyFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    const propertyData = {
      ownerId: user.uid,
      ...JSON.parse(JSON.stringify(data)),
    };

    const propertiesCollection = collection(firestore, 'properties');

    addDoc(propertiesCollection, propertyData)
      .then(() => {
        toast({ title: 'Property Added' });
        router.push('/dashboard/properties');
      })
      .catch((serverError: any) => {
        toast({ variant: 'destructive', title: 'Save Failed' });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
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
                 <FormField control={form.control} name="address.street" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="address.city" render={({ field }) => (<FormItem><FormLabel>City / Town</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="address.postcode" render={({ field }) => (<FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                 </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl font-headline">Investment & Valuation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (<FormItem><FormLabel>Purchase Price (£)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="currentValuation" render={({ field }) => (<FormItem><FormLabel>Current Valuation (£)</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-headline">Description</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={handleMagicDescription} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} AI Description
                </Button>
              </CardHeader>
              <CardContent><FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormControl><Textarea placeholder="AI description will appear here..." className="resize-none" rows={8} {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)}/></CardContent>
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
