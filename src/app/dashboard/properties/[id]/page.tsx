'use client';

import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { properties as allProperties } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, User, Mail, Phone, Calendar as CalendarIcon } from 'lucide-react';
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
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
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
              <CardTitle>Tenant Details</CardTitle>
            </CardHeader>
            <CardContent>
              {property.tenant ? (
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="flex items-center gap-4">
                         <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Tenancy Start</p>
                            <p>{format(new Date(property.tenancy.startDate), 'PPP')}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-4">
                         <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Tenancy End</p>
                            <p>{format(new Date(property.tenancy.endDate), 'PPP')}</p>
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">This property is currently vacant.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className='h-full'>
              <div className="rounded-lg overflow-hidden h-[400px] md:h-full">
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
