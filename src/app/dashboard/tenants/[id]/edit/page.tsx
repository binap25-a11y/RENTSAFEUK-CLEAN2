'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
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
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';

// Zod schema for tenant form validation (can be reused)
const tenantSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Invalid email address'),
  telephone: z.string().min(10, 'Invalid phone number'),
  propertyId: z.string({ required_error: 'Please select a property.' }),
  tenancyStartDate: z.coerce.date({ required_error: 'Please select a start date.' }),
  tenancyEndDate: z.coerce.date().optional(),
  notes: z.string().optional(),
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

// Type for tenant from firestore
interface Tenant {
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    tenancyStartDate: { seconds: number, nanoseconds: number } | Date;
    tenancyEndDate?: { seconds: number, nanoseconds: number } | Date;
    notes?: string;
}


export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
  });
  
  // Fetch the specific tenant to edit
  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId]);

  const { data: tenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  // Fetch properties for the dropdown
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied'])
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  // Populate form with tenant data once loaded
  useEffect(() => {
    if (tenant) {
        const tenantData = {
            ...tenant,
            notes: tenant.notes ?? '',
            tenancyStartDate: tenant.tenancyStartDate instanceof Date ? tenant.tenancyStartDate : new Date(tenant.tenancyStartDate.seconds * 1000),
            tenancyEndDate: tenant.tenancyEndDate ? (tenant.tenancyEndDate instanceof Date ? tenant.tenancyEndDate : new Date(tenant.tenancyEndDate.seconds * 1000)) : undefined,
        };
        form.reset(tenantData);
    }
  }, [tenant, form]);


  async function onSubmit(data: TenantFormValues) {
    if (!user || !firestore || !tenantId) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to update a tenant.',
      });
      return;
    }
    
    try {
      const tenantDocRef = doc(firestore, 'tenants', tenantId);
      await updateDoc(tenantDocRef, {
          ...data,
          ownerId: user.uid, // ensure ownerId is preserved
      });

      toast({
        title: 'Tenant Updated',
        description: `${data.name}'s details have been successfully updated.`,
      });
      router.push('/dashboard/tenants');
    } catch (error) {
      console.error('Failed to update tenant:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'There was an error updating the tenant. Please try again.',
      });
    }
  }
  
  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  if (isLoadingTenant || isLoadingProperties) {
    return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }
  
  if (!tenant) {
      return (
          <div className="text-center py-10">
              <p>Tenant not found.</p>
              <Button asChild variant="link">
                  <Link href="/dashboard/tenants">Return to Tenants List</Link>
              </Button>
          </div>
      )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Tenant</CardTitle>
        <CardDescription>
          Update the details for {tenant.name}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Property</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingProperties ? <div className='flex items-center gap-2'><Loader2 className='animate-spin' /> Loading...</div> : "Select a property"} />
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
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., John Doe" {...field} />
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
                      <Input type="email" placeholder="john.doe@example.com" {...field} />
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
                      <Input type="tel" placeholder="07123456789" {...field} />
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
                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
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
                                value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
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
                      placeholder="Any additional notes about the tenant or tenancy..."
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
                    <Link href="/dashboard/tenants">Cancel</Link>
                </Button>
                <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
