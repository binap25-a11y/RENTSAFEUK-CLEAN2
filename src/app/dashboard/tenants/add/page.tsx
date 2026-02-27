'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

// Standard UK phone regex (Mobile & Landline)
const ukPhoneRegex = /^(((\+44\s?\d{4}|\(?0\d{4}\)?)\s?\d{3}\s?\d{3})|((\+44\s?\d{3}|\(?0\d{3}\)?)\s?\d{3}\s?\d{4})|((\+44\s?\d{2}|\(?0\d{2}\)?)\s?\d{4}\s?\d{4}))(\s?\#(\d{4}|\d{3}))?$/;

// Zod schema for tenant form validation
const tenantSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Please enter a valid email address.'),
  telephone: z.string().regex(ukPhoneRegex, 'Please enter a valid UK phone number.'),
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Please select a property.'),
  monthlyRent: z.coerce.number().min(0, 'Rent cannot be negative').optional(),
  tenancyStartDate: z.coerce.date({ required_error: 'Please select a start date.' }),
  tenancyEndDate: z.coerce.date().optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.tenancyEndDate && data.tenancyStartDate) {
    return data.tenancyEndDate >= data.tenancyStartDate;
  }
  return true;
}, {
  message: "Tenancy end date must be after the start date.",
  path: ["tenancyEndDate"]
});

type TenantFormValues = z.infer<typeof tenantSchema>;

// Type for property documents from Firestore
interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
}

// Helper to safely format dates for input[type="date"]
const formatDateForInput = (value: any) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  try {
    return date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

export default function AddTenantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const propertyIdFromUrl = searchParams.get('propertyId');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      propertyId: propertyIdFromUrl || '',
      name: '',
      email: '',
      telephone: '',
      notes: '',
      monthlyRent: undefined,
    },
  });

  useEffect(() => {
    form.setValue('tenancyStartDate', new Date());
  }, [form]);

  // Fetch properties - strictly hierarchical
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !user || !propertyIdFromUrl) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyIdFromUrl);
  }, [firestore, user, propertyIdFromUrl]);
  const { data: selectedProperty } = useDoc<Property>(propertyRef);
  
  useEffect(() => {
    if (propertyIdFromUrl) {
      form.setValue('propertyId', propertyIdFromUrl, { shouldValidate: true });
    }
  }, [propertyIdFromUrl, form]);


  async function onSubmit(data: TenantFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
        const tenantsCollection = collection(firestore, 'userProfiles', user.uid, 'properties', data.propertyId, 'tenants');
        const newTenant = {
            ...data,
            email: data.email.toLowerCase(),
            ownerId: user.uid,
            status: 'Active',
            createdDate: new Date().toISOString(),
        };

        const cleanedTenantData = JSON.parse(JSON.stringify(newTenant));
        await addDoc(tenantsCollection, cleanedTenantData);
        
        // Update property status
        const propertyDocRef = doc(firestore, 'userProfiles', user.uid, 'properties', data.propertyId);
        await updateDoc(propertyDocRef, { status: 'Occupied' });
        
        toast({
          title: 'Tenant Assigned',
          description: `${data.name} has been assigned successfully.`,
        });
        router.push(`/dashboard/properties/${data.propertyId}`);
    } catch (error: any) {
        console.error("Save failed:", error);
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'Permission denied or data error. Check property hierarchy.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.county, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-lg border-none">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-2xl font-headline text-primary">Assign New Tenant</CardTitle>
        <CardDescription>
          Record tenant identity and tenancy terms for your property records.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {propertyIdFromUrl && selectedProperty ? (
                <div className="space-y-2">
                    <FormLabel className="font-bold">Target Property</FormLabel>
                    <div className="flex items-center justify-between rounded-md border-2 border-primary/20 p-4 bg-primary/5 min-h-[40px]">
                        <p className="font-bold text-primary">{formatAddress(selectedProperty.address)}</p>
                    </div>
                </div>
            ) : (
                <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="font-bold">Select Portfolio Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger className="h-11">
                            <SelectValue placeholder={isLoadingProperties ? 'Loading portfolio...' : 'Choose property'} />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {properties?.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id}>
                            {formatAddress(prop.address)}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Full Legal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" className="h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Telephone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="07123 456789" className="h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
                <FormField
                    control={form.control}
                    name="monthlyRent"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold">Agreed Monthly Rent (£)</FormLabel>
                        <FormControl>
                            <Input type="number" min="0" placeholder="0.00" className="h-11" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tenancyStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Tenancy Start</FormLabel>
                    <FormControl>
                        <Input
                            type="date"
                            className="h-11"
                            value={formatDateForInput(field.value)}
                            onChange={(e) => field.onChange(e.target.value)}
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tenancyEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Tenancy End (Optional)</FormLabel>
                    <FormControl>
                        <Input
                            type="date"
                            className="h-11"
                            value={formatDateForInput(field.value)}
                            onChange={(e) => field.onChange(e.target.value)}
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Management Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Special requirements, pets allowed, reference notes..."
                      className="resize-none min-h-[100px] rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" asChild className="font-bold uppercase tracking-widest text-xs h-11">
                    <Link href={propertyIdFromUrl ? `/dashboard/properties/${propertyIdFromUrl}` : '/dashboard/tenants'}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting} className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg">
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Confirm Assignment'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
