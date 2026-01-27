'use client';

import { useParams, useSearchParams, notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarIcon, User, HardHat, Phone, Tag, AlertTriangle, Home, Building, Banknote, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

// Main interface for a Maintenance Log document from Firestore
interface MaintenanceLog {
    title: string;
    description?: string;
    category: string;
    priority: string;
    status: string;
    reportedBy?: string;
    reportedDate: { seconds: number; nanoseconds: number } | Date;
    contractorName?: string;
    contractorPhone?: string;
    scheduledDate?: { seconds: number; nanoseconds: number } | Date;
    estimatedCost?: number;
    photoUrls?: string[];
    notes?: string;
}

// Interface for a Property document from Firestore
interface Property {
    address: string;
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  const firestore = useFirestore();

  const maintenanceLogRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !id) return null;
    return doc(firestore, 'properties', propertyId, 'maintenanceLogs', id);
  }, [firestore, propertyId, id]);

  const { data: maintenanceLog, isLoading: isLoadingLog, error } = useDoc<MaintenanceLog>(maintenanceLogRef);
  
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);

  if (isLoadingLog || isLoadingProperty) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !propertyId) {
    return <p className='text-destructive'>Error: Could not load maintenance details. {error?.message}</p>
  }
  
  if (!maintenanceLog) {
    return notFound();
  }

  const reportedDate = maintenanceLog.reportedDate ? (maintenanceLog.reportedDate instanceof Date ? maintenanceLog.reportedDate : new Date(maintenanceLog.reportedDate.seconds * 1000)) : null;
  const scheduledDate = maintenanceLog.scheduledDate ? (maintenanceLog.scheduledDate instanceof Date ? maintenanceLog.scheduledDate : new Date(maintenanceLog.scheduledDate.seconds * 1000)) : null;

   const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'destructive';
      case 'Urgent': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/maintenance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
            <h1 className="text-2xl font-bold">{maintenanceLog.title}</h1>
            <p className="text-muted-foreground">{property?.address || 'Loading...'}</p>
        </div>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Issue Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className='flex flex-wrap gap-4 items-center'>
                         <Badge variant={getPriorityVariant(maintenanceLog.priority)}>{maintenanceLog.priority}</Badge>
                         <Badge variant="secondary">{maintenanceLog.status}</Badge>
                         <Badge variant="outline">{maintenanceLog.category}</Badge>
                    </div>
                     {maintenanceLog.description && <p className="text-muted-foreground whitespace-pre-wrap">{maintenanceLog.description}</p>}
                </CardContent>
            </Card>

             {maintenanceLog.photoUrls && maintenanceLog.photoUrls.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Photos</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {maintenanceLog.photoUrls.map((url, index) => (
                            <Link href={url} key={index} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-md group">
                                <Image
                                    src={url}
                                    alt={`Maintenance photo ${index + 1}`}
                                    width={200}
                                    height={200}
                                    className="object-cover w-full aspect-square group-hover:scale-105 transition-transform"
                                />
                            </Link>
                        ))}
                    </CardContent>
                </Card>
             )}

             {maintenanceLog.notes && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Additional Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <p className="text-muted-foreground whitespace-pre-wrap">{maintenanceLog.notes}</p>
                    </CardContent>
                 </Card>
             )}
        </div>
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Reporting</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                        <div>
                            <p className="text-sm font-medium">Reported Date</p>
                            <p className="text-sm text-muted-foreground">{reportedDate ? format(reportedDate, 'PPP') : 'N/A'}</p>
                        </div>
                    </div>
                    {maintenanceLog.reportedBy && (
                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-sm font-medium">Reported By</p>
                                <p className="text-sm text-muted-foreground">{maintenanceLog.reportedBy}</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Contractor & Scheduling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     {maintenanceLog.contractorName && (
                        <div className="flex items-start gap-3">
                            <HardHat className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-sm font-medium">Contractor</p>
                                <p className="text-sm text-muted-foreground">{maintenanceLog.contractorName}</p>
                            </div>
                        </div>
                    )}
                     {maintenanceLog.contractorPhone && (
                        <div className="flex items-start gap-3">
                            <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-sm font-medium">Contractor Phone</p>
                                <p className="text-sm text-muted-foreground">{maintenanceLog.contractorPhone}</p>
                            </div>
                        </div>
                    )}
                     {scheduledDate && (
                        <div className="flex items-start gap-3">
                            <CalendarIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-sm font-medium">Scheduled Date</p>
                                <p className="text-sm text-muted-foreground">{format(scheduledDate, 'PPP')}</p>
                            </div>
                        </div>
                    )}
                     {maintenanceLog.estimatedCost && (
                        <div className="flex items-start gap-3">
                            <Banknote className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-sm font-medium">Estimated Cost</p>
                                <p className="text-sm text-muted-foreground">£{maintenanceLog.estimatedCost.toFixed(2)}</p>
                            </div>
                        </div>
                    )}
                    {!maintenanceLog.contractorName && !scheduledDate && (
                        <p className="text-sm text-muted-foreground text-center py-4">No contractor or schedule information provided yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
