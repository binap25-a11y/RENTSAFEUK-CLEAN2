
'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, CalendarIcon, User, HardHat, Phone, Banknote, MoreVertical, Edit, XCircle, Trash2, AlertCircle, Wrench, Info } from 'lucide-react';
import { format } from 'date-fns';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


// Main interface for a Maintenance Log document from Firestore
interface MaintenanceLog {
    title: string;
    description?: string;
    category: string;
    otherCategoryDetails?: string;
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
    address: {
      nameOrNumber?: string;
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
}

export default function MaintenanceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  const firestore = useFirestore();

  const maintenanceLogRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !id || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId, 'maintenanceLogs', id);
  }, [firestore, propertyId, id, user]);

  const { data: maintenanceLog, isLoading: isLoadingLog, error } = useDoc<MaintenanceLog>(maintenanceLogRef);
  
  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'userProfiles', user.uid, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);
  
  const handleCancelConfirm = async () => {
    if (!maintenanceLogRef) return;
    try {
      await updateDoc(maintenanceLogRef, { status: 'Cancelled' });
      toast({ title: 'Log Cancelled', description: 'The maintenance log has been marked as cancelled.' });
      router.push('/dashboard/maintenance/logged');
    } catch (e) {
      console.error('Error cancelling log:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not cancel the log. Please try again.' });
    } finally {
      setIsCancelDialogOpen(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!maintenanceLogRef) return;
    try {
      await deleteDoc(maintenanceLogRef);
      toast({ title: 'Log Deleted', description: 'The maintenance log has been permanently removed.' });
      router.push('/dashboard/maintenance/logged');
    } catch (e) {
      console.error('Error deleting log:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the log. Please try again.' });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };


  if (isLoadingLog || isLoadingProperty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading maintenance record...</p>
      </div>
    );
  }

  if (error || !propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
        <h2 className="text-lg font-bold">Failed to Load Maintenance Log</h2>
        <p className="text-sm text-muted-foreground max-w-xs">There was an error loading the record details. Ensure the URL is correct.</p>
        <Button asChild variant="outline"><Link href="/dashboard/maintenance/logged">Return to History</Link></Button>
      </div>
    );
  }
  
  if (!maintenanceLog) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6 p-6 text-center">
        <div className="bg-muted p-6 rounded-full">
          <Wrench className="h-12 w-12 text-muted-foreground opacity-20" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Log Record Not Found</h2>
          <p className="text-muted-foreground max-w-xs mx-auto">This maintenance record may have been deleted, or you might be accessing a link without the required property context.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/maintenance/logged">Return to History</Link>
        </Button>
      </div>
    );
  }

  const reportedDate = maintenanceLog.reportedDate ? (maintenanceLog.reportedDate instanceof Date ? maintenanceLog.reportedDate : new Date(maintenanceLog.reportedDate.seconds * 1000)) : null;
  const scheduledDate = maintenanceLog.scheduledDate ? (maintenanceLog.scheduledDate instanceof Date ? maintenanceLog.scheduledDate : new Date(maintenanceLog.scheduledDate.seconds * 1000)) : null;
  const propertyAddress = property?.address ? [property.address.nameOrNumber, property.address.street, property.address.city, property.address.postcode].filter(Boolean).join(', ') : 'Property Context Missing';

   const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'destructive';
      case 'Urgent': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/maintenance/logged">
                <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                <h1 className="text-2xl font-bold">{maintenanceLog.title}</h1>
                <p className="text-muted-foreground">{propertyAddress}</p>
            </div>
            </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/maintenance/${id}/edit?propertyId=${propertyId}`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                    </DropdownMenuItem>
                    {maintenanceLog.status !== 'Cancelled' && (
                        <DropdownMenuItem onClick={() => setIsCancelDialogOpen(true)}>
                            <XCircle className="mr-2 h-4 w-4" /> Cancel Log
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
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
                        {maintenanceLog.category === 'Other' && maintenanceLog.otherCategoryDetails && (
                          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-dashed text-sm">
                            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold uppercase text-[10px] tracking-wider text-muted-foreground block mb-1">Custom Trade Category</span>
                              <p className="text-foreground italic">"{maintenanceLog.otherCategoryDetails}"</p>
                            </div>
                          </div>
                        )}
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
                            <CardTitle>Audit & Tax Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap italic">"{maintenanceLog.notes}"</p>
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

      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to cancel this log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the maintenance log as 'Cancelled'. This action can be undone by editing the log later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Cancel Log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanent Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you absolutely sure? This action cannot be undone. This will permanently delete the maintenance record for "{maintenanceLog.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
