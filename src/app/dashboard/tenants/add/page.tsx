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
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc, getDocs, limit } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

// Zod schema for tenant form validation
const tenantSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Invalid email address'),
  telephone: z.string().min(10, 'Invalid phone number'),
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
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

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

  // Set default date after mount to avoid hydration mismatch
  useEffect(() => {
    form.setValue('tenancyStartDate', new Date());
  }, [form]);

  // Fetch properties for the dropdown if no specific property is pre-selected
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || propertyIdFromUrl) return null; // Only fetch if we need the dropdown
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user, propertyIdFromUrl]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  // Fetch the specific property if an ID is in the URL
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyIdFromUrl) return null;
    return doc(firestore, 'properties', propertyIdFromUrl);
  }, [firestore, propertyIdFromUrl]);
  const { data: selectedProperty, isLoading: isLoadingSelectedProperty } = useDoc<Property>(propertyRef);
  
  useEffect(() => {
    if (propertyIdFromUrl) {
      form.setValue('propertyId', propertyIdFromUrl, { shouldValidate: true });
    }
  }, [propertyIdFromUrl, form]);


  async function onSubmit(data: TenantFormValues) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to add a tenant.',
      });
      return;
    }

    setIsSubmitting(true);
    setIsCheckingEmail(true);

    try {
        // DUPLICATE CHECK: Verify email uniqueness for this landlord
        const emailCheckQuery = query(
            collection(firestore, 'tenants'),
            where('ownerId', '==', user.uid),
            where('email', '==', data.email),
            where('status', '==', 'Active'),
            limit(1)
        );
        const emailCheckSnap = await getDocs(emailCheckQuery);
        
        if (!emailCheckSnap.empty) {
            toast({
                variant: 'destructive',
                title: 'Duplicate Tenant',
                description: `A tenant with email ${data.email} already exists in your active records.`,
            });
            setIsSubmitting(false);
            setIsCheckingEmail(false);
            return;
        }

        const tenantsCollection = collection(firestore, 'tenants');
        const newTenant = {
            ...data,
            ownerId: user.uid,
            status: 'Active',
        };

        const cleanedTenantData = JSON.parse(JSON.stringify(newTenant));

        await addDoc(tenantsCollection, cleanedTenantData);
        
        // After successfully adding tenant, update property status
        const propertyDocRef = doc(firestore, 'properties', data.propertyId);
        await updateDoc(propertyDocRef, { status: 'Occupied' });
        
        toast({
          title: 'Tenant Assigned',
          description: `${data.name} has been assigned to the property.`,
        });
        router.push(`/dashboard/properties/${data.propertyId}`);
    } catch (serverError: any) {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'Could not save tenant. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
        setIsCheckingEmail(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Add New Tenant</CardTitle>
        <CardDescription>
          Fill in the details below to add a new tenant and assign them to a property.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {propertyIdFromUrl ? (
                <div className="space-y-2">
                    <FormLabel>Assign to Property</FormLabel>
                    <div className="flex items-center justify-between rounded-md border p-3 bg-muted min-h-[40px]">
                        {isLoadingSelectedProperty ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                        <p className="font-medium text-sm">{selectedProperty ? formatAddress(selectedProperty.address) : 'Property not found'}</p>
                        )}
                    </div>
                </div>
            ) : (
                <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Assign to Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoadingProperties ? "Loading..." : "Select a property"} />
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
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. John Smith" {...field} />
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
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@example.com" {...field} />
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
                    <FormLabel>Telephone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="07123 456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="monthlyRent"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Monthly Rent (£)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} />
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
                    <FormLabel>Tenancy Start Date</FormLabel>
                    <FormControl>
                        <Input
                            type="date"
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
                    <FormLabel>Tenancy End Date (Optional)</FormLabel>
                    <FormControl>
                        <Input
                            type="date"
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
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add tenancy notes..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" asChild>
                    <Link href={propertyIdFromUrl ? `/dashboard/properties/${propertyIdFromUrl}` : '/dashboard/tenants'}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isCheckingEmail ? 'Checking Email...' : 'Saving...'}
                    </>
                  ) : (
                    'Save Tenant'
                  )}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
