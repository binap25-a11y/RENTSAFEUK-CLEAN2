'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { properties } from '@/data/mock-data';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export default function DeletedPropertiesPage() {
    const [deletedProperties, setDeletedProperties] = useState(properties.filter(p => p.status === 'Deleted'));

    const handleRestore = (propertyId: string) => {
        // In a real app, you would update the property status in your database.
        // For this mock data, we'll just filter it out from the local state.
        setDeletedProperties(prev => prev.filter(p => p.id !== propertyId));
        
        const property = properties.find(p => p.id === propertyId);
        if (property) {
            property.status = 'Vacant';
        }
        
        toast({
            title: 'Property Restored',
            description: `${property?.address} has been restored to your portfolio.`,
        });
    };

  return (
    <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/properties">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-3xl font-bold">Deleted Properties</h1>
                <p className="text-muted-foreground">
                    A list of properties that have been deleted from your portfolio.
                </p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Deleted Properties</CardTitle>
                <CardDescription>You can restore these properties to your active portfolio.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Address</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {deletedProperties.length > 0 ? (
                                deletedProperties.map((property) => (
                                <TableRow key={property.id}>
                                    <TableCell className="font-medium">{property.address}</TableCell>
                                    <TableCell>{property.propertyType}</TableCell>
                                    <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleRestore(property.id)}>
                                        <RefreshCw className="mr-2 h-4 w-4" /> Restore
                                    </Button>
                                    </TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No deleted properties.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
