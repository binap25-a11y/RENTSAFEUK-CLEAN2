'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
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
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, collectionGroup } from 'firebase/firestore';

// Standard UK phone regex (Mobile & Landline)
const ukPhoneRegex = /^(((\+44\s?\d{4}|\(?0\d{4}\)?)\s?\d{3}\s?\d{3})|((\+44\s?\d{3}|\(?0\d{3}\)?)\s?\d{3}\s?\d{4})|((\+44\s?\d{2}|\(?0\d{2}\)?)\s?\d{4}\s?\d{4}))(\s?\#(\d{4}|\d{3}))?$/;

// Zod schema for tenant form validation
const tenantSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Please enter a valid email address.'),
  telephone: z.string().regex(ukPhoneRegex, 'Please enter a valid UK phone number.'),
  propertyId: z.string({ required_error: 'Please select a property.' }),
  monthlyRent: z.coerce.number().min(0, 'Rent cannot be negative').optional(),
  tenancyStartDate: z.coerce.date({ required_error: 'Please select a start date.' }),
  tenancyEndDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

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

interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    monthlyRent?: number;
    tenancyStartDate: { seconds: number, nanoseconds: number } | Date;
    tenancyEndDate?: { seconds: number, nanoseconds: number } | Date;
    notes?: string;
}

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

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.id as string;
  const urlPropertyId = searchParams.get('propertyId');

  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
  });
  
  // Direct reference if propertyId is known
  const directTenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId || !urlPropertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', urlPropertyId, 'tenants', tenantId);
  }, [firestore, tenantId, urlPropertyId, user]);
  const { data: directTenant, isLoading: isLoadingDirect } = useDoc<Tenant>(directTenantRef);

  // collectionGroup fallback
  const tenantSearchQuery = useMemoFirebase(() => {
    if (!firestore || !tenantId || !user || urlPropertyId) return null;
    return query(
      collectionGroup(firestore, 'tenants'),
      where('ownerId', '==', user.uid),
      where('id', '==', tenantId)
    );
  }, [firestore, tenantId, user, urlPropertyId]);
  const { data: searchResults, isLoading: isLoadingSearch } = useCollection<Tenant>(tenantSearchQuery);

  const tenant = useMemo(() => directTenant || searchResults?.[0] || null, [directTenant, searchResults]);
  const isLoadingTenant = isLoadingDirect || isLoadingSearch;

  // Fetch properties for the dropdown
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  useEffect(() => {
    if (tenant) {
        const tenantData = {
            ...tenant,
            notes: tenant.notes ?? '',
            monthlyRent: tenant.monthlyRent,
            tenancyStartDate: tenant.tenancyStartDate instanceof Date ? tenant.tenancyStartDate : new Date((tenant.tenancyStartDate as any).seconds * 1000),
            tenancyEndDate: tenant.tenancyEndDate ? (tenant.tenancyEndDate instanceof Date ? tenant.tenancyEndDate : new Date((tenant.tenancyEndDate as any).seconds * 1000)) : undefined,
        };
        form.reset(tenantData);
    }
  }, [tenant, form]);

  async function onSubmit(data: TenantFormValues) {
    if (!user || !firestore || !tenant) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Authentication error or tenant not found.',
      });
      return;
    }
    
    try {
      const tenantDocRef = doc(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId, 'tenants', tenant.id);
      const updateData = { ...data, ownerId: user.uid };
      const cleanedUpdateData = JSON.parse(JSON.stringify(updateData));

      await updateDoc(tenantDocRef, cleanedUpdateData);

      toast({
        title: 'Tenant Updated',
        description: `${data.name}'s details have been successfully updated.`,
      });
      router.push(`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`);
    } catch (error) {
      console.error('Failed to update tenant:', error);
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  }
  
  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.county, address.postcode].filter(Boolean).join(', ');
  };

  if (isLoadingTenant || isLoadingProperties) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  
  if (!tenant && !isLoadingTenant) return <div className="text-center py-10"><p>Tenant not found.</p><Button asChild variant="link"><Link href="/dashboard/tenants">Return to Tenants List</Link></Button></div>;

  return (
    <Card className="max-w-2xl mx-auto shadow-md border-none">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-2xl font-headline text-primary">Edit Tenant Profile</CardTitle>
        <CardDescription>Update identity and contract details for {tenant?.name}.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Assigned Property</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a property" />
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
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="font-bold">Full Legal Name</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel className="font-bold">Email Address</FormLabel><FormControl><Input className="h-11" type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
               <FormField control={form.control} name="telephone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Telephone</FormLabel><FormControl><Input className="h-11" type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
                <FormField control={form.control} name="monthlyRent" render={({ field }) => (<FormItem><FormLabel className="font-bold">Agreed Rent (£/mo)</FormLabel><FormControl><Input className="h-11" type="number" min="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="tenancyStartDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Contract Start</FormLabel><FormControl><Input className="h-11" type="date" value={formatDateForInput(field.value)} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="tenancyEndDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Contract End (Opt)</FormLabel><FormControl><Input className="h-11" type="date" value={formatDateForInput(field.value)} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel className="font-bold">Management Notes</FormLabel><FormControl><Textarea className="min-h-[100px] resize-none rounded-xl" rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" asChild className="font-bold uppercase tracking-widest text-xs h-11"><Link href={`/dashboard/tenants/${tenantId}?propertyId=${tenant?.propertyId}`}>Cancel</Link></Button>
                <Button type="submit" className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg">Save Profile Changes</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
