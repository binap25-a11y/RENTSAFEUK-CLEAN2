'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bed, Bath, Edit, Trash2, MoreVertical, Loader2, AlertTriangle } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Main interface for a Property document from Firestore
interface Property {
    id: string;
    address: {
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
    propertyType: string;
    status: string;
    bedrooms: number;
    bathrooms: number;
    imageUrl: string;
    notes?: string;
    tenancy?: {
        monthlyRent?: number;
        depositAmount?: number;
        depositScheme?: string;
    }
}

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!firestore || !propertyId) {
      setIsLoading(false);
      return;
    }

    const fetchProperty = async () => {
        const docRef = doc(firestore, 'properties', propertyId);
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
            } else {
                // This means the document truly doesn't exist.
                setError(new Error("Not Found"));
            }
        } catch (err: any) {
            // This will catch permission errors and other network issues.
            console.error("Firestore error:", err);
            setError(err);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchProperty();
  }, [firestore, propertyId]);


  const handleDeleteConfirm = async () => {
    if (!firestore || !property) return;
    
    try {
      const docRef = doc(firestore, 'properties', propertyId);
      await updateDoc(docRef, { status: 'Deleted' });
      toast({
        title: 'Property Deleted',
        description: `${property.address.street} has been moved to the deleted properties list.`,
      });
      router.push('/dashboard/properties');
    } catch (e) {
      console.error('Error deleting property:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete the property. Please try again.',
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    // Handle "not found" specifically to trigger Next.js 404 page
    if (error.message === "Not Found") {
        notFound();
    }

    // Handle permission denied and other errors
    const isPermissionError = error.message.includes('permission-denied') || (error as any).code === 'permission-denied';
    
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <Card className="w-full max-w-lg text-center">
            <CardHeader>
                <CardTitle>{isPermissionError ? "Access Denied" : "Error Loading Property"}</CardTitle>
                <CardDescription>
                    {isPermissionError 
                        ? "You do not have permission to view this property. Please ensure you are logged in with the correct account." 
                        : "An unexpected error occurred while trying to load the property details."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">If you believe this is an error, please try again later.</p>
                { !isPermissionError && <pre className="mt-4 p-2 bg-muted rounded-md text-xs overflow-auto"><code>{error.message}</code></pre>}
            </CardContent>
             <CardFooter className="flex justify-center">
                <Button asChild><Link href="/dashboard/properties">Return to Properties</Link></Button>
            </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (!property) {
    // This case should ideally not be hit if isLoading is false and there is no error,
    // but it's a safe fallback.
    return notFound();
  }

  const { address, status, propertyType, bedrooms, bathrooms, imageUrl, notes } = property;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/dashboard/properties">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{address.street}</h1>
                    <p className="text-muted-foreground">{`${address.city}, ${address.county ? address.county + ', ' : ''}${address.postcode}`}</p>
                </div>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={`/dashboard/properties/${propertyId}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        
        <Card>
            <CardContent className="p-0">
                <Image
                    src={imageUrl}
                    alt={`Image of ${address.street}`}
                    width={800}
                    height={500}
                    className="rounded-t-lg object-cover w-full aspect-video"
                />
            </CardContent>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Badge>{status}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                    <span>{propertyType}</span>
                    <span className='flex items-center gap-1'><Bed className="h-4 w-4" /> {bedrooms}</span>
                    <span className='flex items-center gap-1'><Bath className="h-4 w-4" /> {bathrooms}</span>
                </div>
            </CardHeader>
        </Card>

        {notes && (
            <Card>
                <CardHeader>
                    <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{notes}</p>
                </CardContent>
            </Card>
        )}

      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the property at {property?.address.street}. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
