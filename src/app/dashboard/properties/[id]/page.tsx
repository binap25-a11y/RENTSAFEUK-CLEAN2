'use client';

import { useParams, notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, User, Mail, Phone, Calendar as CalendarIcon, ShieldCheck, Edit, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

// Define types for sub-objects to keep the main interface clean
interface Tenant {
    name: string;
    email: string;
    phone: string;
}

interface Tenancy {
    startDate: string | Date;
    endDate: string | Date;
    monthlyRent: number;
    depositAmount: number;
    depositScheme: string;
}

// Main interface for a Property document from Firestore
interface Property {
    address: string;
    propertyType: string;
    status: string;
    bedrooms: number;
    bathrooms: number;
    imageUrl: string;
    tenant?: Tenant;
    tenancy?: Tenancy;
    // location is not used on this page, but keeping it for future use
}

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'properties', id);
  }, [firestore, id]);

  const { data: property, isLoading, error } = useDoc<Property>(propertyRef);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <p className='text-destructive'>Error: {error.message}</p>
  }
  
  if (!property) {
    return notFound();
  }

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/properties">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{property.address}</h1>
      </div>
      <div className="space-y-6">
        <Card>
            <CardContent className="p-0">
                <Image
                    src={property.imageUrl}
                    alt={`Image of ${property.address}`}
                    width={800}
                    height={500}
                    className="rounded-t-lg object-cover w-full aspect-video"
                />
            </CardContent>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className='mb-2'>{property.address}</CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{property.propertyType}</span>
                            <span className='flex items-center gap-1'><Bed className="h-4 w-4" /> {property.bedrooms}</span>
                            <span className='flex items-center gap-1'><Bath className="h-4 w-4" /> {property.bathrooms}</span>
                        </div>
                    </div>
                    <Badge>{property.status}</Badge>
                </div>
            </CardHeader>
        </Card>
        
         <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle>Tenant &amp; Financials</CardTitle>
                 {property.tenant && (
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline"><Edit className="mr-2 h-4 w-4" /> Edit Tenant</Button>
                        <Button size="sm" variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Tenant</Button>
                    </div>
                )}
            </div>
        </CardHeader>
        <CardContent>
            {property.tenant && property.tenancy ? (
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <span>{property.tenant.name}</span>
                </div>
                <div className="flex items-center gap-4">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <a href={`mailto:${property.tenant.email}`} className="text-primary hover:underline">
                        {property.tenant.email}
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span>{property.tenant.phone}</span>
                </div>

                <div className="border-t pt-4 mt-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-4">
                            <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                            <div>
                                <p className="text-sm text-muted-foreground">Tenancy Start</p>
                                <p>{format(new Date(property.tenancy.startDate), 'PPP')}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <CalendarIcon className="h-5 w-5 text-muted-foreground mt-1" />
                            <div>
                                <p className="text-sm text-muted-foreground">Tenancy End</p>
                                <p>{format(new Date(property.tenancy.endDate), 'PPP')}</p>
                            </div>
                        </div>
                    </div>
                     <div>
                        <p className="text-sm text-muted-foreground">Monthly Rent</p>
                        <p className='font-semibold'>£{property.tenancy.monthlyRent.toFixed(2)}</p>
                    </div>
                </div>
                 <div className="border-t pt-4 mt-4 space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Deposit Amount</p>
                        <p className='font-semibold'>£{property.tenancy.depositAmount.toFixed(2)}</p>
                    </div>
                     <div className="flex items-start gap-4">
                        <ShieldCheck className="h-5 w-5 text-muted-foreground mt-1" />
                         <div>
                            <p className="text-sm text-muted-foreground">Deposit Scheme</p>
                            <p className='font-semibold'>{property.tenancy.depositScheme}</p>
                        </div>
                    </div>
                </div>
            </div>
            ) : (
            <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">This property is currently vacant.</p>
                <Button><UserPlus className="mr-2 h-4 w-4" /> Add Tenant</Button>
            </div>
            )}
        </CardContent>
        </Card>
      </div>
    </div>
  );
}

    