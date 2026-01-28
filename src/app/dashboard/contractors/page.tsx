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
import { useState, useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, PlusCircle, User, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';


// Schema for the form
const contractorSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  trade: z.string().min(2, 'Trade is too short'),
  phone: z.string().min(10, 'Phone number seems too short'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type ContractorFormValues = z.infer<typeof contractorSchema>;

// Type for contractor documents from Firestore
interface Contractor {
    id: string;
    name: string;
    trade: string;
    phone: string;
    email?: string;
}


export default function ContractorsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const form = useForm<ContractorFormValues>({
    resolver: zodResolver(contractorSchema),
  });

  // Fetch contractors
  const contractorsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'contractors'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: contractors, isLoading, error } = useCollection<Contractor>(contractorsQuery);

  const filteredContractors = useMemo(() => {
    if (!contractors) return [];
    if (!searchTerm) return contractors;
    return contractors.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.trade.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contractors, searchTerm]);


  async function onSubmit(data: ContractorFormValues) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in.',
      });
      return;
    }

    try {
        const newContractor = {
            ...data,
            ownerId: user.uid,
        };
        const contractorsCollection = collection(firestore, 'contractors');
        await addDocumentNonBlocking(contractorsCollection, newContractor);
        
        toast({
          title: 'Contractor Added',
          description: `${data.name} has been added to your directory.`,
        });
        form.reset({ name: '', trade: '', phone: '', email: '', notes: '' });
    } catch (error) {
        console.error('Failed to add contractor:', error);
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'There was an error saving the contractor. Please try again.',
        });
    }
  }

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold">Contractors</h1>
        <p className="text-muted-foreground">
          Manage your directory of trusted tradespeople.
        </p>
      </div>

      <Card>
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
              <div className="flex justify-end">
                <Button type="submit">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Contractor
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Contractor Directory</CardTitle>
          <CardDescription>Your list of saved contractors.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-4 max-w-sm">
                 <Input 
                    placeholder="Search by name or trade..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
             <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Trade</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Email</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && error && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-destructive">
                                    Error loading contractors: {error.message}
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && filteredContractors?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    {searchTerm ? `No contractors found for "${searchTerm}".` : 'No contractors added yet.'}
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredContractors?.map(c => (
                            <TableRow key={c.id}>
                                <TableCell className="font-medium">{c.name}</TableCell>
                                <TableCell>{c.trade}</TableCell>
                                <TableCell>{c.phone}</TableCell>
                                <TableCell>{c.email}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
        </CardContent>
       </Card>
    </div>
  );
}
