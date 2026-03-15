
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Info, FileUp, X, FileText, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, addDoc, limit } from 'firebase/firestore';
import { differenceInMonths } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { uploadPropertyDocument } from '@/lib/upload-document';
import { Checkbox } from '@/components/ui/checkbox';

const documentSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Property required.'),
  documentType: z.string({ required_error: 'Please select a document type.' }),
  issueDate: z.coerce.date({ required_error: 'Please select an issue date.' }),
  expiryDate: z.coerce.date().optional().or(z.literal('')),
  notes: z.string().optional(),
  sharedWithTenant: z.boolean().default(false),
}).refine(data => {
  if (!data.expiryDate) return true;
  return new Date(data.expiryDate) > new Date(data.issueDate);
}, {
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
  landlordId: string;
  status: string;
}

export default function UploadDocumentPage() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
        title: '',
        propertyId: '',
        documentType: '',
        notes: '',
        expiryDate: '',
        sharedWithTenant: false,
    }
  });

  const watchIssueDate = form.watch('issueDate');
  const watchExpiryDate = form.watch('expiryDate');
  const watchType = form.watch('documentType');
  const watchPropId = form.watch('propertyId');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // HYDRATION HANDSHAKE: Set default preferences only after client-side mount
  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      const lastProp = localStorage.getItem('last_doc_prop');
      const lastType = localStorage.getItem('last_doc_type');
      if (lastProp) form.setValue('propertyId', lastProp);
      if (lastType) form.setValue('documentType', lastType);
    }
  }, [isMounted, form]);

  const complianceWarning = useMemo(() => {
    if (watchType === 'Gas Safety Certificate' && watchIssueDate && watchExpiryDate) {
        const months = differenceInMonths(new Date(watchExpiryDate), new Date(watchIssueDate));
        if (months > 12) {
            return "Gas Safety Certificates typically require annual renewal (12 months). Please verify the validity period.";
        }
    }
    return null;
  }, [watchType, watchIssueDate, watchExpiryDate]);
  
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'),
      where('landlordId', '==', user.uid),
      limit(500)
    );
  }, [firestore, user]);

  const { data: allProperties } = useCollection<Property>(propertiesQuery);

  const activeProperties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status)) ?? [];
  }, [allProperties]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  async function onSubmit(data: DocumentFormValues) {
    if (!user || !firestore) {
        toast({ variant: 'destructive', title: 'Error', description: 'Services not available. Please try again.' });
        return;
    }
    setIsSaving(true);
    
    try {
      let fileUrl = '';
      if (selectedFile) {
        fileUrl = await uploadPropertyDocument(selectedFile, user.uid, data.propertyId);
      }

      const documentsCollection = collection(firestore, 'documents');
      
      const dataToSave: any = {
        ...data,
        fileUrl,
        landlordId: user.uid,
        expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString() : null,
        createdDate: new Date().toISOString()
      };

      await addDoc(documentsCollection, dataToSave);
      
      // PERSISTENCE HANDSHAKE: Definitive save for future audits
      localStorage.setItem('last_doc_prop', data.propertyId);
      localStorage.setItem('last_doc_type', data.documentType);

      toast({ title: 'Document Logged', description: 'Record saved and preferences synchronized.' });
      router.push('/dashboard/documents');
    } catch (error) {
        console.error('Failed to save document', error);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not upload document or save record.' });
    } finally {
        setIsSaving(false);
    }
  }

  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city].filter(Boolean).join(', ');
  };

  if (!isMounted) return null;

  // DYNAMIC KEYS: Ensure selectors refresh when preferences are loaded
  const propKey = `upload-prop-selector-${watchPropId || 'pending'}`;
  const typeKey = `upload-type-selector-${watchType || 'pending'}`;

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto text-left">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Log Property Document</h1>
        <p className="text-muted-foreground font-medium text-lg">Record a new legal or compliance document and upload the associated file.</p>
      </div>

      <Card className="shadow-lg border-none overflow-hidden">
        <CardHeader className="bg-primary/5 border-b pb-6">
          <CardTitle className="text-xl">Upload Record Details</CardTitle>
          <CardDescription>
            Detailed metadata ensures robust compliance tracking across your estate.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
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
                      <FormLabel className="font-bold">Document Title</FormLabel>
                      <FormControl>
                          <Input placeholder="e.g. Gas Safety Cert 2024" className="h-11" {...field} />
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
                      <FormLabel className="font-bold">Active Property</FormLabel>
                      <Select 
                        key={propKey}
                        onValueChange={(val) => {
                          field.onChange(val);
                          localStorage.setItem('last_doc_prop', val);
                        }} 
                        value={field.value}
                      >
                          <FormControl>
                          <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select a property" />
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
                          <FormLabel className="font-bold">Document Type</FormLabel>
                          <Select 
                            key={typeKey}
                            onValueChange={(val) => {
                              field.onChange(val);
                              localStorage.setItem('last_doc_type', val);
                            }} 
                            value={field.value}
                          >
                          <FormControl>
                              <SelectTrigger className="h-11">
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
                              <FormLabel className="font-bold">Issue Date</FormLabel>
                              <FormControl>
                                  <Input
                                      type="date"
                                      className="h-11"
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
                              <FormLabel className="font-bold">Expiry Date (Optional)</FormLabel>
                              <FormControl>
                                  <Input
                                      type="date"
                                      className="h-11"
                                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                                      onChange={(e) => field.onChange(e.target.value)}
                                  />
                              </FormControl>
                              <FormDescription className="text-[10px]">Leave blank for permanent records.</FormDescription>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </div>

              <FormField
                control={form.control}
                name="sharedWithTenant"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 bg-primary/5 border-primary/10">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="font-bold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Share with Resident
                      </FormLabel>
                      <FormDescription className="text-xs">
                        If enabled, the verified tenant for this property will be able to view and download this document in their hub.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                  <FormLabel className="font-bold">Upload Document File</FormLabel>
                  {selectedFile ? (
                      <div className="flex items-center justify-between p-4 border rounded-xl bg-primary/5 border-primary/20">
                          <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                  <FileText className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                  <p className="text-sm font-bold truncate">{selectedFile.name}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)}>
                              <X className="h-4 w-4" />
                          </Button>
                      </div>
                  ) : (
                      <div className="border-2 border-dashed rounded-xl p-8 text-center bg-muted/5 cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => document.getElementById('file-upload')?.click()}>
                          <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-3 opacity-50" />
                          <p className="text-sm font-bold">Click to select PDF or Image</p>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">Max size 10MB</p>
                          <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,image/*" />
                      </div>
                  )}
              </div>
              
               <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Audit Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add relevant document notes..."
                        className="resize-none rounded-xl"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="ghost" asChild className="font-bold uppercase tracking-widest text-xs h-11">
                      <Link href="/dashboard/documents">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isSaving} className="h-11 px-10 shadow-lg font-bold uppercase tracking-widest text-xs">
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Complete Record'}
                  </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
