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
} from '@/firebase';
import { collection, addDoc, query, where, getDocs, limit } from 'firebase/firestore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';


// Schema for the form
const contractorSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  trade: z.string().min(2, 'Trade is too short'),
  phone: z.string().min(10, 'Phone number seems too short'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type ContractorFormValues = z.infer<typeof contractorSchema>;

export default function AddContractorPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<ContractorFormValues>({
        resolver: zodResolver(contractorSchema),
        defaultValues: {
            name: '',
            trade: '',
            phone: '',
            email: '',
            notes: ''
        }
    });

    async function onSubmit(data: ContractorFormValues) {
        if (!user || !firestore) {
        toast({
            variant: 'destructive',
            title: 'Authentication Error',
            description: 'You must be logged in.',
        });
        return;
        }

        setIsSubmitting(true);

        try {
            // DUPLICATE CHECK: Verify phone uniqueness for this user - strictly hierarchical
            const contractorsCollection = collection(firestore, 'userProfiles', user.uid, 'contractors');
            const phoneCheckQuery = query(
                contractorsCollection,
                where('ownerId', '==', user.uid),
                where('phone', '==', data.phone),
                where('status', '==', 'Active'),
                limit(1)
            );
            const phoneCheckSnap = await getDocs(phoneCheckQuery);

            if (!phoneCheckSnap.empty) {
                toast({
                    variant: 'destructive',
                    title: 'Duplicate Contractor',
                    description: `A contractor with phone ${data.phone} already exists in your records.`,
                });
                setIsSubmitting(false);
                return;
            }

            const newContractor = {
                ...data,
                ownerId: user.uid,
                status: 'Active'
            };
            
            await addDoc(contractorsCollection, newContractor);
            
            toast({
            title: 'Contractor Added',
            description: `${data.name} has been added to your directory.`,
            });
            router.push('/dashboard/contractors');
        } catch (error) {
            console.error('Failed to add contractor:', error);
            toast({
                variant: 'destructive',
                title: 'Save Failed',
                description: 'There was an error saving the contractor. Please try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Add New Contractor</CardTitle>
                <CardDescription>Add a new tradesperson to your directory for easy access later.</CardDescription>
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
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                        Add Contractor
                    </Button>
                </div>
                </form>
            </Form>
            </CardContent>
        </Card>
    )
}
