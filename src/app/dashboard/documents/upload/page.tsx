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
import { Upload, Loader2, FileText } from 'lucide-react';
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

// Schema for the form
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const documentSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Property required.'),
  documentType: z.string({ required_error: 'Please select a document type.' }),
  issueDate: z.coerce.date({ required_error: 'Please select an issue date.' }),
  expiryDate: z.coerce.date({ required_error: 'Please select an expiry date.' }),
  documentFile: z
    .custom<FileList>()
    .optional()
    .refine((files) => !files || files.length <= 1, 'Please select a single file.')
    .refine((files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE, `Max file size is 5MB.`),
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
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
        title: '',
        propertyId: '',
        documentType: '',
        notes: '',
    }
  });
  
  // Fetch properties - strictly scoped to user
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  // Filter for active properties in-memory to bypass index requirement
  const activeProperties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  async function onSubmit(data: DocumentFormValues) {
    if (!user || !firestore || !storage) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in.',
      });
      return;
    }
    
    setIsUploading(true);

    try {
      let fileUri = '';
      let finalFileName = '';

      // Only upload if a file is provided
      if (data.documentFile && data.documentFile.length > 0) {
        const file = data.documentFile[0];
        const uniqueFileName = `${Date.now()}-${file.name}`;
        const fileStorageRef = storageRef(storage, `documents/${user.uid}/${uniqueFileName}`);

        // Upload file
        const uploadResult = await uploadBytes(fileStorageRef, file);
        fileUri = await getDownloadURL(uploadResult.ref);
        finalFileName = file.name;
      }

      const { documentFile, ...formData } = data;
      
      const newDocument = {
        ...formData,
        ownerId: user.uid,
        fileUri: fileUri || null,
        fileName: finalFileName || null,
      };

      const documentsCollection = collection(firestore, 'properties', data.propertyId, 'documents');
      await addDoc(documentsCollection, newDocument);
      
      toast({
        title: fileUri ? 'Document Uploaded' : 'Document Record Saved',
        description: fileUri 
          ? 'The document has been successfully uploaded and saved.' 
          : 'The document details have been saved without a file attachment.',
      });
      router.push('/dashboard/documents');
    } catch (error) {
        console.error('Failed to upload document', error);
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'There was an error saving the document record. Please try again.',
        });
    } finally {
        setIsUploading(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city].filter(Boolean).join(', ');
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Log Document</CardTitle>
        <CardDescription>
          Fill in the details. You can optionally attach a file now or log the details and upload later.
        </CardDescription>
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
              name="documentFile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document File (Optional - Max 5MB)</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                        <Button asChild className="w-full cursor-pointer" variant="outline">
                        <label htmlFor="file-upload">
                            <Upload className="mr-2 h-4 w-4" />
                            {fileName ? 'Change File' : 'Choose File (Optional)'}
                            <Input
                            id="file-upload"
                            type="file"
                            className="sr-only"
                            onChange={(e) => {
                                field.onChange(e.target.files);
                                setFileName(e.target.files?.[0]?.name || '');
                            }}
                            />
                        </label>
                        </Button>
                        {fileName && (
                            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-1">
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <span className="text-xs font-medium text-primary truncate flex-1">
                                    Selected: {fileName}
                                </span>
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => {
                                        field.onChange(undefined);
                                        setFileName('');
                                    }}
                                >
                                    &times;
                                </Button>
                            </div>
                        )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : fileName ? 'Save & Upload' : 'Save Details'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
