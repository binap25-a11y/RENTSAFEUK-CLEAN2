import Link from 'next/link';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Bed, Bath, Trash2 } from 'lucide-react';
import { properties } from '@/data/mock-data';

export default function PropertiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Properties</h1>
          <p className="text-muted-foreground">
            A list of all properties in your portfolio.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/properties/add">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Property
          </Link>
        </Button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <Card key={property.id} className="group overflow-hidden flex flex-col">
             <Link href={`/dashboard/properties/${property.id}`} className="block">
                <div className="overflow-hidden">
                    <Image
                        src={property.imageUrl}
                        alt={`Image of ${property.address}`}
                        width={400}
                        height={250}
                        className="object-cover w-full aspect-video group-hover:scale-105 transition-transform duration-300"
                    />
                </div>
             </Link>
            <CardHeader>
               <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                        <Link href={`/dashboard/properties/${property.id}`} className="hover:underline">
                            {property.address}
                        </Link>
                    </CardTitle>
                    <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'}>
                        {property.status}
                    </Badge>
               </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{property.propertyType}</span>
                    <span className='flex items-center gap-1'><Bed className="h-4 w-4" /> {property.bedrooms}</span>
                    <span className='flex items-center gap-1'><Bath className="h-4 w-4" /> {property.bathrooms}</span>
                </div>
            </CardContent>
            <CardFooter className="flex items-center gap-2">
                 <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/properties/${property.id}`}>
                        View Details
                    </Link>
                </Button>
                <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete Property</span>
                </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
