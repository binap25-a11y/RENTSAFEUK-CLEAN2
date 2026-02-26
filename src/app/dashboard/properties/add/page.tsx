'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
} from '@/firebase';
import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  Loader2, 
  ShieldAlert, 
  MapPin, 
  Home, 
  Building, 
  Building2, 
  Hotel, 
  Warehouse, 
  Bed, 
  Bath, 
  PoundSterling, 
  Info, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Robust UK Postcode Regex
const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;

const propertySchema = z.object({
  address: z.object({
    nameOrNumber: z.string().trim().optional(),
    street: z.string().trim().min(3, 'Please enter a valid street address.'),
    city: z.string().trim().min(2, 'Please enter a valid city or town.'),
    county: z.string().trim().optional(),
    postcode: z.string().trim().regex(ukPostcodeRegex, 'Please enter a valid UK postcode (e.g. SW1A 1AA).'),
  }),
  propertyType: z.string({ required_error: 'Please select a property type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  bedrooms: z.coerce.number().nonnegative('Bedrooms cannot be negative'),
  bathrooms: z.coerce.number().nonnegative('Bathrooms cannot be negative'),
  notes: z.string().optional(),
  purchasePrice: z.coerce.number().nonnegative('Price cannot be negative').optional(),
  currentValuation: z.coerce.number().nonnegative('Valuation cannot be negative').optional(),
  tenancy: z.object({
    monthlyRent: z.coerce.number().nonnegative('Rent cannot be negative').optional(),
    depositAmount: z.coerce.number().nonnegative('Deposit cannot be negative').optional(),
    depositScheme: z.string().optional(),
  }).optional(),
}).refine(data => {
    if (!data.tenancy?.depositAmount || data.tenancy.depositAmount <= 0) {
        return true;
    }
    return !!data.tenancy.depositScheme?.trim();
}, {
  message: "Deposit scheme is required if a deposit amount is entered.",
  path: ["tenancy", "depositScheme"]
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const propertyTypes = [
  { value: 'House', icon: Home, label: 'House' },
  { value: 'Flat', icon: Building, label: 'Flat / Apt' },
  { value: 'HMO', icon: Hotel, label: 'HMO' },
  { value: 'Bungalow', icon: Home, label: 'Bungalow' },
  { value: 'Maisonette', icon: Building2, label: 'Maisonette' },
  { value: 'Studio', icon: Warehouse, label: 'Studio' },
];

export default function AddPropertyPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      bedrooms: 0,
      bathrooms: 0,
      status: 'Vacant',
      propertyType: 'House',
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

  const watchAddress = form.watch('address');
  
  const mapUrl = useMemo(() => {
    if (!watchAddress) return null;
    const { street, city, postcode } = watchAddress;
    const fullAddress = [street, city, postcode].filter(Boolean).join(', ');
    if (fullAddress.length < 5) return null;
    return `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`;
  }, [watchAddress]);

  const progress = (step / 4) * 100;

  async function onSubmit(data: PropertyFormValues) {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    try {
        const duplicateQuery = query(
            collection(firestore, 'userProfiles', user.uid, 'properties'),
            where('ownerId', '==', user.uid),
            where('address.street', '==', data.address.street),
            where('address.postcode', '==', data.address.postcode),
            where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']),
            limit(1)
        );
        const duplicateSnap = await getDocs(duplicateQuery);

        if (!duplicateSnap.empty) {
            toast({
                variant: 'destructive',
                title: 'Duplicate Property',
                description: 'A property with this street and postcode already exists in your active portfolio.',
            });
            setIsSubmitting(false);
            return;
        }

        const propertyData = {
            ownerId: user.uid,
            ...JSON.parse(JSON.stringify(data)),
            createdDate: new Date().toISOString(),
        };

        const propertiesCollection = collection(firestore, 'userProfiles', user.uid, 'properties');
        await addDoc(propertiesCollection, propertyData);
        
        toast({ title: 'Property Added', description: 'The property has been successfully added to your portfolio.' });
        router.push('/dashboard/properties');
    } catch (serverError: any) {
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save property. Please try again.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) fieldsToValidate = ['address.nameOrNumber', 'address.street', 'address.city', 'address.postcode'];
    if (step === 2) fieldsToValidate = ['propertyType', 'bedrooms', 'bathrooms', 'status'];
    if (step === 3) fieldsToValidate = ['purchasePrice', 'currentValuation', 'tenancy.monthlyRent', 'tenancy.depositAmount', 'tenancy.depositScheme'];

    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Onboard New Property</h1>
        <p className="text-muted-foreground font-medium">Follow the steps below to accurately record your property details.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-lg overflow-hidden">
            <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {step}
                </div>
                <span className="font-bold text-sm uppercase tracking-widest text-primary">
                  {step === 1 && "Location & Identity"}
                  {step === 2 && "Property Specification"}
                  {step === 3 && "Investment & Tenancy"}
                  {step === 4 && "Media & Final Audit"}
                </span>
              </div>
              <span className="text-xs font-bold text-muted-foreground">{step} of 4</span>
            </div>
            <Progress value={progress} className="h-1 rounded-none bg-muted" />
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-8">
                
                {/* STEP 1: LOCATION */}
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-4">
                        <FormField control={form.control} name="address.nameOrNumber" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Building Name/No</FormLabel>
                            <FormControl><Input placeholder="e.g. Flat 1 or 12" className="h-11" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="address.street" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Street Address</FormLabel>
                            <FormControl><Input placeholder="e.g. High Street" className="h-11" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField control={form.control} name="address.city" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold">City/Town</FormLabel>
                              <FormControl><Input placeholder="London" className="h-11" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="address.postcode" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="font-bold">Post Code</FormLabel>
                              <FormControl><Input placeholder="W1A 1AA" className="h-11 uppercase" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <FormLabel className="font-bold flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          Live Map Preview
                        </FormLabel>
                        <div className="aspect-square w-full rounded-xl overflow-hidden border-2 border-muted bg-muted shadow-inner relative">
                          {mapUrl ? (
                            <iframe width="100%" height="100%" style={{ border: 0 }} title="Property Map" loading="lazy" src={mapUrl}></iframe>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-muted-foreground/40">
                              <MapPin className="h-12 w-12 mb-2" />
                              <p className="text-xs font-bold uppercase tracking-widest">Enter address to preview map</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: DETAILS */}
                {step === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      <FormLabel className="font-bold text-lg">What type of property is this?</FormLabel>
                      <FormField
                        control={form.control}
                        name="propertyType"
                        render={({ field }) => (
                          <FormItem className="space-y-3">
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="grid grid-cols-2 md:grid-cols-3 gap-4"
                              >
                                {propertyTypes.map((type) => (
                                  <FormItem key={type.value}>
                                    <FormControl>
                                      <RadioGroupItem value={type.value} className="sr-only" />
                                    </FormControl>
                                    <FormLabel className={cn(
                                      "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-muted/50",
                                      field.value === type.value ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm" : "border-muted"
                                    )}>
                                      <type.icon className={cn("h-8 w-8", field.value === type.value ? "text-primary" : "text-muted-foreground")} />
                                      <span className={cn("text-xs font-bold uppercase tracking-wider", field.value === type.value ? "text-primary" : "text-muted-foreground")}>
                                        {type.label}
                                      </span>
                                    </FormLabel>
                                  </FormItem>
                                ))}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <FormField control={form.control} name="bedrooms" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold flex items-center gap-2"><Bed className="h-4 w-4" /> Bedrooms</FormLabel>
                          <FormControl><Input type="number" min="0" className="h-11" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="bathrooms" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold flex items-center gap-2"><Bath className="h-4 w-4" /> Bathrooms</FormLabel>
                          <FormControl><Input type="number" min="0" className="h-11" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Current Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              {['Vacant', 'Occupied', 'Under Maintenance'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                )}

                {/* STEP 3: FINANCIALS */}
                {step === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          <PoundSterling className="h-5 w-5 text-primary" />
                          Investment Data
                        </h3>
                        <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Purchase Price (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} /></FormControl>
                            <FormDescription>Basis for yield calculations.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="currentValuation" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Current Valuation (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="space-y-6">
                        <h3 className="font-bold text-lg flex items-center gap-2 text-green-600">
                          <ShieldAlert className="h-5 w-5" />
                          Rental & Compliance
                        </h3>
                        <FormField control={form.control} name="tenancy.monthlyRent" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Estimated Monthly Rent (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="tenancy.depositAmount" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Required Deposit (£)</FormLabel>
                            <FormControl><Input type="number" min="0" placeholder="0.00" className="h-11" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        {form.watch('tenancy.depositAmount') > 0 && (
                          <FormField control={form.control} name="tenancy.depositScheme" render={({ field }) => (
                            <FormItem className="animate-in slide-in-from-top-2 duration-200">
                              <FormLabel className="font-bold text-destructive">Protection Scheme Name</FormLabel>
                              <FormControl><Input placeholder="e.g. DPS, TDS, MyDeposits" className="h-11 border-destructive/20 focus:border-destructive" {...field} /></FormControl>
                              <FormDescription className="text-destructive/70 text-[10px] uppercase font-bold tracking-tight">Legal requirement for deposits in the UK.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: MEDIA & AUDIT */}
                {step === 4 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      <FormLabel className="font-bold text-lg">Property Media</FormLabel>
                      <div className="border-2 border-dashed border-muted-foreground/20 rounded-2xl p-12 text-center flex flex-col items-center gap-4 bg-muted/5 group hover:border-primary/50 transition-colors cursor-pointer">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold">Add Main Property Photo</p>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">PNG or JPG up to 10MB</p>
                        </div>
                        <Button type="button" variant="outline" size="sm">Select File</Button>
                        <p className="text-[10px] text-muted-foreground italic">Note: File storage features will be enabled once property is saved.</p>
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <FormField control={form.control} name="notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Portfolio Audit Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe structural condition, specific features, or long-term maintenance needs..." 
                              className="resize-none min-h-[150px] rounded-xl" 
                              {...field} 
                              value={field.value ?? ''} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-amber-900">Ready to List</p>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          By saving this property, it will be added to your active management dashboard. You can add tenants, log maintenance, and upload compliance documents immediately after.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* NAVIGATION */}
                <div className="flex items-center justify-between pt-8 border-t">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={step === 1 ? () => router.back() : prevStep}
                    className="font-bold uppercase tracking-widest text-xs h-11"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {step === 1 ? "Cancel" : "Back"}
                  </Button>
                  
                  {step < 4 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      className="font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-md"
                    >
                      Continue
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="font-bold uppercase tracking-widest text-xs h-11 px-10 shadow-lg bg-primary hover:bg-primary/90"
                    >
                      {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizing...</> : "Complete Onboarding"}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-md bg-muted/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Landlord Compliance Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-primary tracking-tighter">1. Gas & Electrical Safety</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In the UK, you must have a valid Gas Safety Certificate (CP12) updated annually and an EICR valid for 5 years.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-primary tracking-tighter">2. The "How to Rent" Guide</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You must serve the latest version of the government's "How to Rent" guide to tenants at the start of any new tenancy.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-primary tracking-tighter">3. Deposit Protection</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Legally, you must protect a tenant's deposit in a government-approved scheme within 30 days of receiving it.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-background border border-primary/10 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-destructive">Pro Tip</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  "Accurate addresses ensure compliance reminders are triggered correctly for local authority regulations."
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Summary Preview</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Property Address</p>
                <p className="text-sm font-bold truncate">{(watchAddress?.street || watchAddress?.city || watchAddress?.postcode) ? [watchAddress.street, watchAddress.city, watchAddress.postcode].filter(Boolean).join(', ') : "Not specified yet"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Type</p>
                  <Badge variant="outline" className="h-5 text-[10px]">{form.watch('propertyType')}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Layout</p>
                  <p className="text-xs font-bold">{form.watch('bedrooms')} Bed / {form.watch('bathrooms')} Bath</p>
                </div>
              </div>
              <div className="pt-4 border-t border-dashed space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Rent</span>
                  <span className="text-sm font-bold text-green-600">£{form.watch('tenancy.monthlyRent')?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Est. Yield</span>
                  <span className="text-sm font-bold text-primary">
                    {form.watch('purchasePrice') > 0 ? ((form.watch('tenancy.monthlyRent') * 12 / form.watch('purchasePrice')) * 100).toFixed(1) + '%' : '0%'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
