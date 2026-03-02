'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import { collection, query, where, addDoc, doc, limit } from 'firebase/firestore';
import { differenceInMonths } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const documentSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Property required.'),
  documentType: z.string({ required_error: 'Please select a document type.' }),
  issueDate: z.coerce.date({ required_error: 'Please select an issue date.' }),
  expiryDate: z.coerce.date({ required_error: 'Please select an expiry date.' }),
  notes: z.string().optional(),
}).refine(data => data.expiryDate > data.issueDate, {
  message: "Expiry date must be after the issue date.",
  path: ["expiryDate"]
});

type DocumentFormValues = z.infer<typeof documentSchema>;

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
  ownerId: string;
  status: string;
}

export default function UploadDocumentPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
        title: '',
        propertyId: '',
        documentType: '',
        notes: '',
    }
  });

  const watchIssueDate = form.watch('issueDate');
  const watchExpiryDate = form.watch('expiryDate');
  const watchType = form.watch('documentType');

  const complianceWarning = useMemo(() => {
    if (watchType === 'Gas Safety Certificate' && watchIssueDate && watchExpiryDate) {
        const months = differenceInMonths(watchExpiryDate, watchIssueDate);
        if (months > 12) {
            return "Gas Safety Certificates typically require annual renewal (12 months). Please verify the validity period.";
        }
    }
    return null;
  }, [watchType, watchIssueDate, watchExpiryDate]);
  
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  const activeProperties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  async function onSubmit(data: DocumentFormValues) {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Services not available. Please try again.' });
        return;
    }
    setIsSaving(true);
    
    // Correct hierarchical path
    const documentsCollection = collection(firestore, 'userProfiles', user.uid, 'properties', data.propertyId, 'documents');
    
    const dataToSave: any = {
      ...data,
      ownerId: user.uid,
    };

    try {
      await addDoc(documentsCollection, dataToSave);
      
      toast({ title: 'Document Logged', description: 'The record has been saved successfully.' });
      router.push('/dashboard/documents');
    } catch (error) {
        console.error('Failed to save document', error);
        const permissionError = new FirestorePermissionError({
          path: documentsCollection.path,
          operation: 'create',
          requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save document record.' });
    } finally {
        setIsSaving(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city].filter(Boolean).join(', ');
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Log Property Document</CardTitle>
        <CardDescription>
          Record a new legal or compliance document.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             {complianceWarning && (
                <Alert className="bg-amber-50 border-amber-200">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 text-sm font-bold">Compliance Guidance</AlertTitle>
                    <AlertDescription className="text-amber-700 text-xs">{complianceWarning}</AlertDescription>
                </Alert>
             )}

             <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Document Title</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g. Gas Safety Cert 2024" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Active Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoadingProperties ? 'Loading...' : "Select a property"} />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {activeProperties.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id}>
                                {formatAddress(prop.address)}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                    control={form.control}
                    name="documentType"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Document Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {[
                               'Tenancy Agreement', 'Inventory', 'Gas Safety Certificate', 'Electrical Certificate', 'EPC', 'Insurance', 'Deposit Protection', 'Licence', 'Correspondence', 'Invoice'
                            ].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="issueDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Issue Date</FormLabel>
                            <FormControl>
                                <Input
                                    type="date"
                                    value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                    onChange={(e) => field.onChange(e.target.value)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                 />
                <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Expiry Date</FormLabel>
                            <FormControl>
                                <Input
                                    type="date"
                                    value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                    onChange={(e) => field.onChange(e.target.value)}
                                />
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
                    <Textarea
                      placeholder="Add relevant document notes..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" asChild>
                    <Link href="/dashboard/documents">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Record'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
