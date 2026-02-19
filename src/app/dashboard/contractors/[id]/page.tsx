'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Trash2, MoreVertical, Loader2, HardHat, Phone, Mail, FileText } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Type for contractor from firestore
interface Contractor {
    id: string;
    name: string;
    trade: string;
    email?: string;
    phone: string;
    notes?: string;
    status?: string;
    ownerId: string;
}


export default function ContractorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const contractorRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'contractors', id);
  }, [firestore, id]);

  const { data: contractor, isLoading, error } = useDoc<Contractor>(contractorRef);

  const handleArchiveConfirm = async () => {
    if (!firestore || !contractor || !contractorRef) return;
    try {
      await updateDoc(contractorRef, { status: 'Archived' });
      toast({
        title: 'Contractor Archived',
        description: `${contractor.name} has been moved to the archived contractors list.`,
      });
      router.push('/dashboard/contractors');
    } catch (e) {
      console.error('Error archiving contractor:', e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not archive the contractor. Please try again.',
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

  if (error || (contractor && user && contractor.ownerId !== user.uid)) {
    return <p className='text-destructive'>Error: Could not load contractor details. You may not have permission to view this record.</p>
  }
  
  if (!contractor) {
    return notFound();
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
            <div className='flex items-center gap-4'>
                <Button variant="outline" size="icon" asChild>
                  <Link href="/dashboard/contractors">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div>
                  <h1 className="text-2xl font-bold font-headline break-words">{contractor.name}</h1>
                  <p className="text-muted-foreground">{contractor.trade}</p>
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
                        <Link href={`/dashboard/contractors/${id}/edit`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </DropdownMenuItem>
                    {contractor.status !== 'Archived' && (
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Archive
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        
        <Card className="shadow-sm">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6 border-t bg-muted/5">
                <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 shrink-0 mt-1">
                        <HardHat className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Trade</p>
                        <p className="font-semibold text-foreground break-words">{contractor.trade}</p>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 shrink-0 mt-1">
                        <Phone className="h-5 w-5 text-primary" />
                    </div>
                     <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Phone</p>
                        <a href={`tel:${contractor.phone}`} className="font-semibold text-primary hover:underline block break-words">
                            {contractor.phone}
                        </a>
                    </div>
                </div>
                {contractor.email && (
                    <div className="flex items-start gap-4">
                        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0 mt-1">
                            <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 overflow-hidden">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Email</p>
                            <a href={`mailto:${contractor.email}`} className="font-semibold text-primary hover:underline break-all block">
                                {contractor.email}
                            </a>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

        {contractor.notes && (
            <Card className="shadow-sm">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Specialist Notes</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 border-t bg-muted/5">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed italic">"{contractor.notes}"</p>
                </CardContent>
            </Card>
        )}
      </div>
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                This will move {contractor.name} to the archived contractors list. You can restore them later.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleArchiveConfirm}
                >
                Archive
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
