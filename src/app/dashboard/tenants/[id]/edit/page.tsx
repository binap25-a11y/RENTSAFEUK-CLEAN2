
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  FormDescription,
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
import { Loader2, CalendarDays } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';

const ukPhoneRegex = /^(((\+44\s?\d{4}|\(?0\d{4}\)?)\s?\d{3}\s?\d{3})|((\+44\s?\d{3}|\(?0\d{3}\)?)\s?\d{3}\s?\d{4})|((\+44\s?\d{2}|\(?0\d{2}\)?)\s?\d{4}\s?\d{4}))(\s?\#(\d{4}|\d{3}))?$/;

const tenantSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Please enter a valid email address.').trim().toLowerCase(),
  telephone: z.string().regex(ukPhoneRegex, 'Please enter a valid UK phone number.'),
  propertyId: z.string({ required_error: 'Please select a property.' }),
  monthlyRent: z.coerce.number().min(0, 'Rent cannot be negative').optional(),
  rentDueDay: z.coerce.number().min(1).max(31, 'Select a day between 1 and 31'),
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
    rentDueDay?: number;
    tenancyStartDate: { seconds: number, nanoseconds: number } | Date;
    tenancyEndDate?: { seconds: number, nanoseconds: number } | Date;
    notes?: string;
    userId?: string;
    landlordId: string;
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
  const tenantId = params.id as string;

  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
  });
  
  const tenantRef = useMemoFirebase(() => {
    if (!firestore || !tenantId || !user) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId, user]);
  const { data: tenant, isLoading: isLoadingTenant } = useDoc<Tenant>(tenantRef);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'),
      where('landlordId', '==', user.uid),
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
            rentDueDay: tenant.rentDueDay || 1,
            tenancyStartDate: tenant.tenancyStartDate instanceof Date ? tenant.tenancyStartDate : new Date((tenant.tenancyStartDate as any).seconds * 1000),
            tenancyEndDate: tenant.tenancyEndDate ? (tenant.tenancyEndDate instanceof Date ? tenant.tenancyEndDate : new Date((tenant.tenancyEndDate as any).seconds * 1000)) : undefined,
        };
        form.reset(tenantData);
    }
  }, [tenant, form]);

  async function onSubmit(data: TenantFormValues) {
    if (!user || !firestore || !tenant || !tenantRef) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Tenant record context missing.',
      });
      return;
    }
    setIsSaving(true);
    
    try {
      // Normalize email for consistent handshake
      const normalizedEmail = data.email.toLowerCase().trim();
      
      const updateData = { 
        ...data, 
        email: normalizedEmail,
        userId: tenant.userId || ''
      };
      const cleanedUpdateData = JSON.parse(JSON.stringify(updateData));

      await updateDoc(tenantRef, cleanedUpdateData);

      toast({
        title: 'Registry Updated',
        description: 'Identity mappings preserved.',
      });
      router.push(`/dashboard/tenants/${tenant.id}?propertyId=${tenant.propertyId}`);
    } catch (error) {
      console.error('Registry sync failed:', error);
      toast({ variant: 'destructive', title: 'Sync Failed' });
    } finally {
      setIsSaving(false);
    }
  }
  
  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  if (isLoadingTenant || isLoadingProperties) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!tenant && !isLoadingTenant) return <div className="text-center py-10"><p>Tenant not found.</p></div>;

  return (
    <Card className="max-w-2xl mx-auto shadow-md border-none text-left">
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
               <FormField control={form.control} name="email" render={({ field }) => (
                 <FormItem>
                   <FormLabel className="font-bold">Email Address</FormLabel>
                   <FormControl><Input className="h-11" type="email" {...field} /></FormControl>
                   <FormDescription className="text-[10px]">Verification uses this normalized email.</FormDescription>
                   <FormMessage />
                 </FormItem>
               )} />
               <FormField control={form.control} name="telephone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Telephone</FormLabel><FormControl><Input className="h-11" type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
                <FormField control={form.control} name="monthlyRent" render={({ field }) => (<FormItem><FormLabel className="font-bold">Agreed Rent (£/mo)</FormLabel><FormControl><Input className="h-11" type="number" min="0" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField
                    control={form.control}
                    name="rentDueDay"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            Rent Due Day
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={String(field.value)}>
                            <FormControl>
                                <SelectTrigger className="h-11">
                                    <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {Array.from({ length: 31 }, (_, i) => (i + 1)).map(day => (
                                    <SelectItem key={day} value={String(day)}>{day}{[1, 21, 31].includes(day) ? 'st' : [2, 22].includes(day) ? 'nd' : [3, 23].includes(day) ? 'rd' : 'th'} of month</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="tenancyStartDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Contract Start</FormLabel><FormControl><Input className="h-11" type="date" value={formatDateForInput(field.value)} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="tenancyEndDate" render={({ field }) => (<FormItem><FormLabel className="font-bold">Contract End (Opt)</FormLabel><FormControl><Input className="h-11" type="date" value={formatDateForInput(field.value)} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel className="font-bold">Management Notes</FormLabel><FormControl><Textarea className="min-h-[100px] resize-none rounded-xl" rows={4} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" asChild className="font-bold uppercase tracking-widest text-xs h-11"><Link href={`/dashboard/tenants/${tenantId}?propertyId=${tenant?.propertyId}`}>Cancel</Link></Button>
                <Button type="submit" disabled={isSaving} className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Profile Changes'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
