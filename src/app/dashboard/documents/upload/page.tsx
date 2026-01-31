'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  useUser,
  useFirestore,
  useStorage,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// Schema for the form
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const documentSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  propertyId: z.string({ required_error: 'Please select a property.' }),
  documentType: z.string({ required_error: 'Please select a document type.' }),
  issueDate: z.date({ required_error: 'Please select an issue date.' }),
  expiryDate: z.date({ required_error: 'Please select an expiry date.' }),
  documentFile: z
    .custom<FileList>()
    .refine((files) => files?.length === 1, 'Document file is required.')
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`),
  notes: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

// Type for property documents from Firestore
interface Property {
  address: string;
  ownerId: string;
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
  });
  
  // Fetch properties for the dropdown
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

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
      const file = data.documentFile[0];
      const uniqueFileName = `${Date.now()}-${file.name}`;
      const fileStorageRef = storageRef(storage, `documents/${user.uid}/${uniqueFileName}`);

      // Upload file
      const uploadResult = await uploadBytes(fileStorageRef, file);
      const fileUri = await getDownloadURL(uploadResult.ref);

      const { documentFile, ...formData } = data;
      
      const newDocument = {
        ...formData,
        ownerId: user.uid,
        fileUri: fileUri,
        fileName: file.name,
      };

      const documentsCollection = collection(firestore, 'properties', data.propertyId, 'documents');
      await addDoc(documentsCollection, newDocument);
      
      toast({
        title: 'Document Uploaded',
        description: 'The document has been successfully uploaded and saved.',
      });
      router.push('/dashboard/documents');
    } catch (error) {
        console.error('Failed to upload document', error);
        toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'There was an error uploading the document. Please try again.',
        });
    } finally {
        setIsUploading(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
        <CardDescription>
          Fill in the details and select a file to upload.
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
                    <FormLabel>Property</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={isLoadingProperties ? 'Loading...' : "Select a property"} />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {properties?.map((prop) => (
                            <SelectItem key={prop.id} value={prop.id}>
                            {prop.address}
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                     <FormItem className="flex flex-col">
                         <FormLabel>Issue Date</FormLabel>
                         <Popover>
                         <PopoverTrigger asChild>
                             <FormControl>
                             <Button variant={'outline'} className={cn('pl-3 text-left font-normal',!field.value && 'text-muted-foreground')}>
                                 {field.value ? (format(field.value, 'PPP')) : (<span>Pick a date</span>)}
                                 <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                             </Button>
                             </FormControl>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="start">
                             <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                         </PopoverContent>
                         </Popover>
                         <FormMessage />
                     </FormItem>
                     )}
                 />
                <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Expiry Date</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button variant={'outline'} className={cn('pl-3 text-left font-normal',!field.value && 'text-muted-foreground')}>
                                {field.value ? (format(field.value, 'PPP')) : (<span>Pick a date</span>)}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                        </PopoverContent>
                        </Popover>
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
                  <FormLabel>Document File</FormLabel>
                  <FormControl>
                    <Button asChild className="w-full cursor-pointer">
                      <label htmlFor="file-upload">
                        <Upload className="mr-2 h-4 w-4" />
                        Choose File
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
                  </FormControl>
                  <FormMessage />
                   {fileName && <p className="text-sm text-muted-foreground pt-2">Selected file: {fileName}</p>}
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
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
                      Uploading...
                    </>
                  ) : 'Save Document'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
