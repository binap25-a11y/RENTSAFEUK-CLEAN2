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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Search, ChevronsUpDown } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc, limit } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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
  status: string;
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
    },
  });

  const selectedPropertyId = form.watch('propertyId');

  useEffect(() => {
    form.setValue('tenancyStartDate', new Date());
  }, [form]);

  // Fetch properties - strictly hierarchical
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
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
    if (!address) return 'N/A';
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
            <FormField
              control={form.control}
              name="propertyId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="font-bold">Select Portfolio Property</FormLabel>
                  <Popover open={isPropSelectorOpen} onOpenChange={setIsPropSelectorOpen}>
                    <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                    "w-full justify-between h-11 bg-background text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                            >
                                {selectedProperty 
                                    ? formatAddress(selectedProperty.address) 
                                    : (isLoadingProperties ? "Loading portfolio..." : "Search by address or postcode...")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl border-primary/10">
                        <div className="flex items-center border-b px-3 bg-muted/20">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <Input 
                                placeholder="Type address..." 
                                className="h-11 border-0 focus-visible:ring-0 bg-transparent" 
                                value={propertySearch}
                                onChange={(e) => setPropertySearch(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-72">
                            {filteredProperties.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground italic">
                                    No properties found matching your search.
                                </div>
                            ) : (
                                <div className="p-1">
                                    {filteredProperties.map(p => (
                                        <Button
                                            key={p.id}
                                            variant="ghost"
                                            className={cn(
                                                "w-full justify-start font-normal text-xs py-6 h-auto whitespace-normal text-left px-4",
                                                p.id === field.value && "bg-primary/5 text-primary font-bold"
                                            )}
                                            onClick={() => {
                                                form.setValue('propertyId', p.id);
                                                setIsPropSelectorOpen(false);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "h-2 w-2 rounded-full",
                                                    p.id === field.value ? "bg-primary" : "bg-transparent"
                                                )} />
                                                {formatAddress(p.address)}
                                            </div>
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
                <Button type="submit" disabled={isSubmitting} className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg bg-primary hover:bg-primary/90">
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Confirm Assignment'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
