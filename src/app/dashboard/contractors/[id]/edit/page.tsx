'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';


// Schema for the form
const contractorSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  trade: z.string().min(2, 'Trade is too short'),
  phone: z.string().min(10, 'Phone number seems too short'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type ContractorFormValues = z.infer<typeof contractorSchema>;

interface Contractor {
    name: string;
    trade: string;
    phone: string;
    email?: string;
    notes?: string;
}

export default function EditContractorPage() {
    const router = useRouter();
    const params = useParams();
    const contractorId = params.id as string;

    const { user } = useUser();
    const firestore = useFirestore();

    const form = useForm<ContractorFormValues>({
        resolver: zodResolver(contractorSchema),
        defaultValues: {
            name: '',
            trade: '',
            phone: '',
            email: '',
            notes: '',
        },
    });

    const contractorRef = useMemoFirebase(() => {
        if (!firestore || !contractorId || !user) return null;
        return doc(firestore, 'userProfiles', user.uid, 'contractors', contractorId);
    }, [firestore, contractorId, user]);

    const { data: contractor, isLoading } = useDoc<Contractor>(contractorRef);

    useEffect(() => {
        if (contractor) {
            form.reset({
                ...contractor,
                email: contractor.email ?? '',
                notes: contractor.notes ?? '',
            });
        }
    }, [contractor, form]);


    async function onSubmit(data: ContractorFormValues) {
        if (!user || !firestore || !contractorId) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not update contractor.',
        });
        return;
        }

        try {
            const contractorDocRef = doc(firestore, 'userProfiles', user.uid, 'contractors', contractorId);
            await updateDoc(contractorDocRef, { ...data });
            
            toast({
                title: 'Contractor Updated',
                description: `${data.name} has been updated.`,
            });
            router.push('/dashboard/contractors');
        } catch (error) {
            console.error('Failed to update contractor:', error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'There was an error saving the contractor. Please try again.',
            });
        }
    }
    
    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }
    
    if (!contractor) {
        return <p>Contractor not found.</p>;
    }


    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Edit Contractor</CardTitle>
                <CardDescription>Update the details for {contractor.name}.</CardDescription>
            </CardHeader>
            <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name / Company Name</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., John Smith Plumbing" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="trade"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Trade</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Electrician, Plumber" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                            <Input placeholder="07123456789" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                            <Input type="email" placeholder="contact@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                            <Textarea placeholder="e.g., 'Specializes in boiler repairs', 'Available on weekends'" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end gap-2">
                    <Button variant="outline" type="button" asChild>
                        <Link href="/dashboard/contractors">Cancel</Link>
                    </Button>
                    <Button type="submit">Save Changes</Button>
                </div>
                </form>
            </Form>
            </CardContent>
        </Card>
    )
}
