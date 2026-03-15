
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
import { Loader2, ArrowLeft, CalendarDays } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { safeToDate, formatDateForInput } from '@/lib/date-utils';

const ukPhoneRegex = /^(((\+44\s?\d{4}|\(?0\d{4}\)?)\s?\d{3}\s?\d{3})|((\+44\s?\d{3}|\(?0\d{3}\)?)\s?\d{3}\s?\d{3})|((\+44\s?\d{2}|\(?0\d{2}\)?)\s?\d{4}\s?\d{4}))(\s?\#(\d{4}|\d{3}))?$/;

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
    tenancyStartDate: any;
    tenancyEndDate?: any;
    notes?: string;
    userId?: string;
    landlordId: string;
}

export default function EditTenantPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.id as string;
  const propertyIdFromUrl = searchParams.get('propertyId');

  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
        propertyId: propertyIdFromUrl || '',
    }
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
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
      limit(500)
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  useEffect(() => {
    if (tenant && !isLoadingProperties) {
        // SELECTION MEMORY HANDSHAKE: Use session preferences during profile updates
        const storedProp = localStorage.getItem('last_tenant_prop');
        const storedRentDay = localStorage.getItem('last_rent_day');

        form.reset({
            name: tenant.name || '',
            email: tenant.email || '',
            telephone: tenant.telephone || '',
            propertyId: storedProp || tenant.propertyId || propertyIdFromUrl || '',
            monthlyRent: tenant.monthlyRent,
            rentDueDay: storedRentDay ? Number(storedRentDay) : (tenant.rentDueDay || 1),
            tenancyStartDate: safeToDate(tenant.tenancyStartDate) || new Date(),
            tenancyEndDate: safeToDate(tenant.tenancyEndDate) || undefined,
            notes: tenant.notes || '',
        });
    }
  }, [tenant, form, propertyIdFromUrl, isLoadingProperties]);

  // REACTIVE KEY: Forces re-render of Select components when registry data loads or preferences change
  const dataKey = tenant ? `registry-loaded-${localStorage.getItem('last_tenant_prop')}-${localStorage.getItem('last_rent_day')}` : 'registry-pending';

  async function onSubmit(data: TenantFormValues) {
    if (!user || !firestore || !tenant || !tenantRef) {
      toast({ variant: 'destructive', title: 'Error', description: 'Tenant record context missing.' });
      return;
    }
    setIsSaving(true);
    
    try {
      const normalizedEmail = data.email.toLowerCase().trim();
      const updateData = { 
        ...data, 
        email: normalizedEmail,
        userId: tenant.userId || ''
      };
      const cleanedUpdateData = JSON.parse(JSON.stringify(updateData));

      await updateDoc(tenantRef, cleanedUpdateData);

      if (tenant.propertyId !== data.propertyId) {
          const oldPropRef = doc(firestore, 'properties', tenant.propertyId);
          await updateDoc(oldPropRef, { 
              tenantEmails: arrayRemove(tenant.email)
          });
          
          const newPropRef = doc(firestore, 'properties', data.propertyId);
          await updateDoc(newPropRef, { 
              status: 'Occupied',
              tenantEmail: normalizedEmail,
              tenantEmails: arrayUnion(normalizedEmail)
          });
      } else if (tenant.email !== normalizedEmail) {
          const propRef = doc(firestore, 'properties', data.propertyId);
          await updateDoc(propRef, { 
              tenantEmails: arrayRemove(tenant.email)
          });
          await updateDoc(propRef, { 
              tenantEmail: normalizedEmail,
              tenantEmails: arrayUnion(normalizedEmail)
          });
      }

      toast({ title: 'Registry Updated' });
      router.push(`/dashboard/tenants/${tenant.id}?propertyId=${data.propertyId}`);
    } catch (error) {
      console.error('Registry sync failed:', error);
      toast({ variant: 'destructive', title: 'Sync Failed' });
    } finally {
      setIsSaving(false);
    }
  }
  
  const formatAddress = (address: Property['address']) => {
    if (!address) return 'N/A';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  const isLoading = isLoadingTenant || isLoadingProperties;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (!tenant) return <div className="text-center py-10"><p>Tenant not found.</p></div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto text-left">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={`/dashboard/tenants/${tenantId}?propertyId=${tenant?.propertyId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-headline">Edit Tenant Profile</h1>
      </div>

      <Card className="shadow-md border-none text-left overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10">
          <CardTitle>Identity & Contract</CardTitle>
          <CardDescription>Update details for {tenant?.name}.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Assigned Property</FormLabel>
                    <Select 
                      key={`${dataKey}-prop`} 
                      onValueChange={(val) => { field.onChange(val); localStorage.setItem('last_tenant_prop', val); }} 
                      value={field.value ? String(field.value) : ""}
                    >
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
                    <FormDescription className="text-[10px]">Select the asset where this resident is legally assigned.</FormDescription>
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
                          <FormLabel className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Rent Due Day</FormLabel>
                          <Select 
                            key={`${dataKey}-rent-day`} 
                            onValueChange={(val) => { field.onChange(Number(val)); localStorage.setItem('last_rent_day', val); }} 
                            value={field.value ? String(field.value) : "1"}
                          >
                              <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select day" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {Array.from({ length: 31 }, (_, i) => (i + 1)).map(day => (
                                    <SelectItem key={day} value={String(day)}>
                                        {day}{[1, 21, 31].includes(day) ? 'st' : [2, 22].includes(day) ? 'nd' : [3, 23].includes(day) ? 'rd' : 'th'} of month
                                    </SelectItem>
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
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                  </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
