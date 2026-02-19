
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useRef } from 'react';
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
import { Loader2, Wand2, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  useUser,
  useFirestore,
  useStorage,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, addDoc, limit } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { analyzeDocument } from '@/ai/flows/document-analysis-flow';

// Schema for the form
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const documentSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Property required.'),
  documentType: z.string({ required_error: 'Please select a document type.' }),
  issueDate: z.coerce.date({ required_error: 'Please select an issue date.' }),
  expiryDate: z.coerce.date({ required_error: 'Please select an expiry date.' }),
  notes: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

// Type for property documents from Firestore
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
  const storage = useStorage();
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
        title: '',
        propertyId: '',
        documentType: '',
        notes: '',
    }
  });
  
  // Fetch properties
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  const activeProperties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  const handleAIAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Maximum file size is 5MB.' });
        return;
    }

    setIsAnalyzing(true);
    try {
        const reader = new FileReader();
        const dataUriPromise = new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
        });
        
        const dataUri = await dataUriPromise;
        const result = await analyzeDocument({
            photoDataUri: dataUri,
            documentHint: form.getValues('title'),
        });

        form.setValue('title', result.title);
        form.setValue('documentType', result.documentType);
        if (result.issueDate) form.setValue('issueDate', new Date(result.issueDate));
        if (result.expiryDate) form.setValue('expiryDate', new Date(result.expiryDate));
        form.setValue('notes', result.notes);

        toast({ title: 'Analysis Complete', description: 'Form fields have been updated based on the document.' });
    } catch (error) {
        console.error('AI Analysis failed', error);
        toast({ variant: 'destructive', title: 'AI Error', description: 'Could not analyze document. Please fill in details manually.' });
    } finally {
        setIsAnalyzing(false);
    }
  };

  async function onSubmit(data: DocumentFormValues) {
    if (!user || !firestore) return;
    setIsSaving(true);

    try {
      const documentsCollection = collection(firestore, 'properties', data.propertyId, 'documents');
      await addDoc(documentsCollection, {
        ...data,
        ownerId: user.uid,
      });
      
      toast({ title: 'Document Logged', description: 'The record has been saved successfully.' });
      router.push('/dashboard/documents');
    } catch (error) {
        console.error('Failed to save document', error);
        toast({ variant: 'destructive', title: 'Save Failed' });
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
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>Log Property Document</CardTitle>
                <CardDescription>
                Record a new legal or compliance document.
                </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-2">
                <Input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleAIAnalysis}
                    accept="image/*"
                />
                <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                >
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    AI Auto-Fill (Photo)
                </Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
             <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Document Title</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Gas Safety Certificate 2024" {...field} />
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
                            <SelectValue placeholder={isLoadingProperties ? 'Loading portfolio...' : "Select a property"} />
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
                      placeholder="Add any relevant notes here..."
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
