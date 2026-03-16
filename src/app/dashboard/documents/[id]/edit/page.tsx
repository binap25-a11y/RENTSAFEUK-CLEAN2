
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
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
import { Loader2, ArrowLeft, FileUp, X, FileText, ExternalLink, ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadPropertyDocument } from '@/lib/upload-document';
import { Checkbox } from '@/components/ui/checkbox';

const documentSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  documentType: z.string({ required_error: 'Please select a document type.' }),
  issueDate: z.coerce.date({ required_error: 'Please select an issue date.' }),
  expiryDate: z.coerce.date().optional().or(z.literal('')),
  notes: z.string().optional(),
  sharedWithTenant: z.boolean().default(false),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

interface DocumentRecord {
    id: string;
    title: string;
    propertyId: string;
    documentType: string;
    issueDate: any;
    expiryDate: any;
    notes?: string;
    fileUrl?: string;
    sharedWithTenant?: boolean;
}

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function EditDocumentPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
  });

  const watchType = form.watch('documentType');

  const docRef = useMemoFirebase(() => {
    if (!firestore || !user || !id) return null;
    return doc(firestore, 'documents', id);
  }, [firestore, user, id]);

  const { data: documentRecord, isLoading } = useDoc<DocumentRecord>(docRef);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (documentRecord && isMounted) {
      const sessionPreference = localStorage.getItem('last_doc_type');
      
      form.reset({
        title: documentRecord.title,
        documentType: sessionPreference || documentRecord.documentType,
        issueDate: toDate(documentRecord.issueDate) || new Date(),
        expiryDate: toDate(documentRecord.expiryDate) || '',
        notes: documentRecord.notes || '',
        sharedWithTenant: documentRecord.sharedWithTenant || false,
      });
    }
  }, [documentRecord, form, isMounted]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  async function onSubmit(data: DocumentFormValues) {
    if (!user || !firestore || !docRef || !propertyId) {
        toast({ variant: 'destructive', title: 'Error' });
        return;
    }
    setIsSaving(true);
    
    try {
      let fileUrl = documentRecord?.fileUrl || '';
      if (selectedFile) {
        fileUrl = await uploadPropertyDocument(selectedFile, user.uid, propertyId);
      }

      localStorage.setItem('last_doc_type', data.documentType);

      const updateData = {
        ...data,
        fileUrl,
        expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString() : null,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(docRef, JSON.parse(JSON.stringify(updateData)));
      
      toast({ title: 'Document Updated' });
      router.push('/dashboard/documents');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
        setIsSaving(false);
    }
  }

  if (isLoading || !isMounted) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!documentRecord) return <div className="text-center py-20 italic">Record not found.</div>;

  const selectKey = `doc-type-edit-${watchType || 'loading'}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild><Link href="/dashboard/documents"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold font-headline">Edit Audit Record</h1>
      </div>

      <Card className="shadow-lg border-none">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle>Update Details</CardTitle>
          <CardDescription>Modify metadata or replace the attached file.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel className="font-bold">Document Title</FormLabel><FormControl><Input className="h-11" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="documentType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Document Type</FormLabel>
                  <Select key={selectKey} onValueChange={(val) => { field.onChange(val); localStorage.setItem('last_doc_type', val); }} value={field.value}>
                    <FormControl><SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {['Tenancy Agreement', 'Inventory', 'Gas Safety Certificate', 'Electrical Certificate', 'EPC', 'Insurance', 'Deposit Protection', 'Licence', 'Correspondence', 'Invoice'].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Issue Date</FormLabel><FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold">Expiry Date</FormLabel><FormControl><Input type="date" className="h-11" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="sharedWithTenant" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 bg-primary/5">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <div className="space-y-1 leading-none"><FormLabel className="font-bold">Share with Resident</FormLabel></div>
                </FormItem>
              )} />

              <div className="space-y-4">
                  <FormLabel className="font-bold">Attached File</FormLabel>
                  {selectedFile ? (
                      <div className="flex items-center justify-between p-4 border rounded-xl bg-primary/5">
                          <div className="flex items-center gap-3 min-w-0"><FileText className="h-5 w-5 text-primary" /><span className="text-sm font-bold truncate">{selectedFile.name}</span></div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedFile(null)}><X className="h-4 w-4" /></Button>
                      </div>
                  ) : documentRecord.fileUrl ? (
                      <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/30">
                          <span className="text-xs font-bold uppercase text-muted-foreground">Current File Attached</span>
                          <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="sm" asChild><a href={documentRecord.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3 w-3" /> View</a></Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => document.getElementById('edit-file-upload')?.click()}>Replace</Button>
                          </div>
                      </div>
                  ) : (
                      <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/10" onClick={() => document.getElementById('edit-file-upload')?.click()}>
                          <FileUp className="h-6 w-6 mx-auto text-muted-foreground mb-2 opacity-50" />
                          <p className="text-xs font-bold">Add file attachment</p>
                      </div>
                  )}
                  <input id="edit-file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,image/*" />
              </div>
              
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel className="font-bold">Audit Notes</FormLabel><FormControl><Textarea rows={4} className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="ghost" asChild className="font-bold uppercase tracking-widest text-xs h-11"><Link href="/dashboard/documents">Cancel</Link></Button>
                  <Button type="submit" disabled={isSaving} className="h-11 px-10 shadow-lg font-bold uppercase tracking-widest text-xs">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                  </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
