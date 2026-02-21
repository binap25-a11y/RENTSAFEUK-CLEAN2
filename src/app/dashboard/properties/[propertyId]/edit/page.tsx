
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
import { doc, setDoc, query, collection, where, getDocs, limit } from 'firebase/firestore';
import { Loader2, ShieldAlert } from 'lucide-react';

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
}).refine(data => {
  if (data.tenancy?.depositAmount && data.tenancy.depositAmount > 0) {
    return typeof data.tenancy.depositScheme === 'string' && data.tenancy.depositScheme.trim() !== '';
  }
  return true;
}, {
  message: "Deposit scheme is required if a deposit amount is entered.",
  path: ["tenancy", "depositScheme"]
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.propertyId as string;
  
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        purchasePrice: property.purchasePrice,
        currentValuation: property.currentValuation,
        tenancy: property.tenancy || {},
      });
    }
  }, [property, form]);


  async function onSubmit(data: PropertyFormValues) {
    if (!firestore || !propertyId || !user) return;
    
    setIsSubmitting(true);

    try {
      // UNIQUENESS CHECK (if address changed)
      if (data.address.street !== property?.address.street || data.address.postcode !== property?.address.postcode) {
          const duplicateQuery = query(
              collection(firestore, 'properties'),
              where('ownerId', '==', user.uid),
              where('address.street', '==', data.address.street),
              where('address.postcode', '==', data.address.postcode),
              where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
              limit(1)
          );
          const duplicateSnap = await getDocs(duplicateQuery);
          if (!duplicateSnap.empty && duplicateSnap.docs[0].id !== propertyId) {
              toast({
                  variant: 'destructive',
                  title: 'Duplicate Property',
                  description: 'Another active property with this street and postcode already exists.',
              });
              setIsSubmitting(false);
              return;
          }
      }

      const docRef = doc(firestore, 'properties', propertyId);
      const cleanedData = JSON.parse(JSON.stringify(data));
      await setDoc(docRef, { ...cleanedData, ownerId: user.uid }, { merge: true });
      
      toast({ title: "Property Updated" });
      router.push(`/dashboard/properties/${propertyId}`);
    } catch (e) {
      console.error("Error updating property:", e);
      toast({ variant: "destructive", title: "Update Failed" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
      <Card className="max-w-4xl mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl font-headline">Edit Property</CardTitle>
        <CardDescription>Update the location and details for your portfolio property.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <Card className="border-none shadow-none bg-muted/30">
              <CardHeader><CardTitle className="text-lg font-headline">Address</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                  <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (<FormItem><FormLabel>Property Name / Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="address.street" render={({ field }) => (<FormItem><FormLabel>Street Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="address.city" render={({ field }) => (<FormItem><FormLabel>City / Town</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="address.postcode" render={({ field }) => (<FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-none bg-muted/30">
              <CardHeader><CardTitle className="text-lg font-headline">Investment & Tenancy</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (<FormItem><FormLabel>Purchase Price (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="currentValuation" render={({ field }) => (<FormItem><FormLabel>Current Valuation (£)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
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

            <Card className="border-none shadow-none bg-muted/30">
              <CardHeader><CardTitle className="text-lg font-headline">Basic Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="propertyType" render={({ field }) => (<FormItem><FormLabel>Property Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{[ 'House', 'Flat', 'Bungalow', 'Maisonette', 'Studio', 'HMO', ].map((type) => (<SelectItem key={type} value={type}> {type} </SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{['Vacant', 'Occupied', 'Under Maintenance'].map( (status) => (<SelectItem key={status} value={status}> {status} </SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" asChild><Link href={`/dashboard/properties/${propertyId}`}>Cancel</Link></Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

    