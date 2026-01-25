'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { properties as allProperties } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, User, Mail, Phone, Calendar as CalendarIcon, ShieldCheck, Edit, Trash2, UserPlus } from 'lucide-react';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const property = allProperties.find((p) => p.id === id);

  if (!property) {
    return notFound();
  }

  const mapBbox = `${property.location.lng - 0.002},${property.location.lat - 0.001},${property.location.lng + 0.002},${property.location.lat + 0.001}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapBbox}&layer=mapnik&marker=${property.location.lat},${property.location.lng}`;

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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
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
                    <CardTitle>Tenant & Financials</CardTitle>
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
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Location</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg overflow-hidden h-[400px]">
                        <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        src={mapUrl}>
                        </iframe>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
