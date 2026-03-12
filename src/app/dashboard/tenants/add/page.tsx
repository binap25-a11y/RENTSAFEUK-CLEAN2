
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, ChevronsUpDown, CalendarDays } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, doc, updateDoc, addDoc, limit, where } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const ukPhoneRegex = /^(((\+44\s?\d{4}|\(?0\d{4}\)?)\s?\d{3}\s?\d{3})|((\+44\s?\d{3}|\(?0\d{3}\)?)\s?\d{3}\s?\d{4})|((\+44\s?\d{2}|\(?0\d{2}\)?)\s?\d{4}\s?\d{4}))(\s?\#(\d{4}|\d{3}))?$/;

const tenantSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Please enter a valid email address.').trim().toLowerCase(),
  telephone: z.string().regex(ukPhoneRegex, 'Please enter a valid UK phone number.'),
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Please select a property.'),
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
  status: string;
}

const prepareForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(prepareForFirestore);
  
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = prepareForFirestore(val);
      }
    }
  }
  return result;
};

export default function AddTenantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const propertyIdFromUrl = searchParams.get('propertyId');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPropSelectorOpen, setIsPropSelectorOpen] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');

  const form = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      propertyId: propertyIdFromUrl || '',
      name: '',
      email: '',
      telephone: '',
      notes: '',
      monthlyRent: undefined,
      rentDueDay: 1,
    },
  });

  const selectedPropertyId = form.watch('propertyId');

  useEffect(() => {
    form.setValue('tenancyStartDate', new Date());
  }, [form]);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'),
      where('landlordId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);
  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const properties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (!propertySearch) return properties;
    const term = propertySearch.toLowerCase();
    return properties.filter(p => 
        [p.address.nameOrNumber, p.address.street, p.address.city, p.address.postcode]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(term)
    );
  }, [properties, propertySearch]);

  const selectedProperty = useMemo(() => 
    properties.find(p => p.id === selectedPropertyId), 
  [properties, selectedPropertyId]);
  
  async function onSubmit(data: TenantFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    const tenantsCollection = collection(firestore, 'tenants');
    // CRITICAL: Force lowercase and trim for reliable identity discovery
    const normalizedEmail = data.email.toLowerCase().trim();
    
    const newTenant = {
        ...data,
        email: normalizedEmail,
        userId: '', 
        landlordId: user.uid, 
        status: 'Active',
        verified: false,
        createdDate: new Date().toISOString(),
    };

    try {
        await addDoc(tenantsCollection, prepareForFirestore(newTenant));
        
        const propertyDocRef = doc(firestore, 'properties', data.propertyId);
        await updateDoc(propertyDocRef, { status: 'Occupied' });

        toast({ title: 'Tenant Assigned' });
        router.push(`/dashboard/properties/${data.propertyId}`);
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Sync Failed' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    if (!address) return 'N/A';
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-lg border-none overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="text-2xl font-headline text-primary">Assign New Tenant</CardTitle>
        <CardDescription>Establishing identity mapping via verified email for resident portal access.</CardDescription>
      </CardHeader>
      <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="font-bold">Portfolio Property</FormLabel>
                  <Popover open={isPropSelectorOpen} onOpenChange={setIsPropSelectorOpen}>
                    <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                                variant="outline"
                                className={cn("w-full justify-between h-11 bg-background text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                                {selectedProperty ? formatAddress(selectedProperty.address) : "Search portfolio assets..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl border-primary/10">
                        <div className="flex items-center border-b px-3 bg-muted/20">
                            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                            <Input placeholder="Type address..." className="h-11 border-0 focus-visible:ring-0 bg-transparent" value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} />
                        </div>
                        <ScrollArea className="h-72">
                            {filteredProperties.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground italic">No matches.</div>
                            ) : (
                                <div className="p-1">
                                    {filteredProperties.map(p => (
                                        <Button
                                            key={p.id}
                                            variant="ghost"
                                            className={cn("w-full justify-start font-normal text-xs py-4 h-auto text-left px-4", p.id === field.value && "bg-primary/5 text-primary font-bold")}
                                            onClick={() => { form.setValue('propertyId', p.id); setIsPropSelectorOpen(false); }}
                                        >
                                            {formatAddress(p.address)}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel className="font-bold">Full Legal Name</FormLabel><FormControl><Input placeholder="John Smith" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <FormField control={form.control} name="email" render={({ field }) => (
                 <FormItem>
                   <FormLabel className="font-bold">Resident Portal Email</FormLabel>
                   <FormControl><Input type="email" placeholder="tenant@example.com" className="h-11" {...field} /></FormControl>
                   <FormDescription className="text-[10px] leading-tight">This email is used for portal verification and MUST be lowercase.</FormDescription>
                   <FormMessage />
                 </FormItem>
               )} />
               <FormField control={form.control} name="telephone" render={({ field }) => (<FormItem><FormLabel className="font-bold">Telephone</FormLabel><FormControl><Input type="tel" className="h-11" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-6">
                <FormField control={form.control} name="monthlyRent" render={({ field }) => (<FormItem><FormLabel className="font-bold">Agreed Monthly Rent (£)</FormLabel><FormControl><Input type="number" min="0" className="h-11" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="rentDueDay" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="font-bold flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Rent Due Day</FormLabel>
                        <Select onValueChange={field.onChange} value={String(field.value)}>
                            <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{Array.from({ length: 31 }, (_, i) => (i + 1)).map(day => (<SelectItem key={day} value={String(day)}>{day} of month</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="tenancyStartDate" render={({ field }) => (
                <FormItem><FormLabel className="font-bold">Tenancy Start</FormLabel><FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="tenancyEndDate" render={({ field }) => (
                <FormItem><FormLabel className="font-bold">Tenancy End (Optional)</FormLabel><FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel className="font-bold">Audit Notes</FormLabel><FormControl><Textarea className="resize-none min-h-[100px] rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>)} />

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="ghost" className="h-11" asChild><Link href="/dashboard/tenants">Cancel</Link></Button>
                <Button type="submit" disabled={isSubmitting} className="h-11 px-10 shadow-lg bg-primary hover:bg-primary/90 font-bold">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Complete Assignment'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
