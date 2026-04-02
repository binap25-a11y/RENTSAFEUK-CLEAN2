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
    defaultValues: {
      title: '',
      documentType: '',
      issueDate: new Date(),
      expiryDate: '',
      notes: '',
      sharedWithTenant: false,
    }
  });

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
        title: documentRecord.title || '',
        documentType: sessionPreference || documentRecord.documentType || '',
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
      
      toast({ title: 'Registry Synchronized' });
      router.push('/dashboard/documents');
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
        setIsSaving(false);
    }
  }

  if (isLoading || !isMounted) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!documentRecord) return <div className="text-center py-20 italic">Record not found.</div>;

  const selectKey = `doc-type-v4-${id}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild><Link href="/dashboard/documents"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold font-headline">Edit Audit Record</h1>
      </div>

      <Card className="shadow-2xl border-none overflow-hidden rounded-[2rem]">
        <CardHeader className="bg-primary/5 border-b pb-6 px-8 pt-8">
          <CardTitle className="text-xl font-headline flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" /> Update Registry Details
          </CardTitle>
          <CardDescription className="text-base font-medium">Modify metadata or replace the attached legal file.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 px-8 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 text-left">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Document Title</FormLabel><FormControl><Input className="h-12 bg-muted/5 border-2 rounded-xl focus:bg-background transition-all" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="documentType" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Document Classification</FormLabel>
                  <Select key={selectKey} onValueChange={(val) => { field.onChange(val); localStorage.setItem('last_doc_type', val); }} value={field.value}>
                    <FormControl><SelectTrigger className="h-12 bg-muted/5 border-2 rounded-xl focus:bg-background"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent className="rounded-xl">
                      {['Tenancy Agreement', 'Inventory', 'Gas Safety Certificate', 'Electrical Certificate', 'EPC', 'Insurance', 'Deposit Protection', 'Licence', 'Correspondence', 'Invoice'].map(type => <SelectItem key={type} value={type} className="rounded-lg">{type}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Issue Date</FormLabel><FormControl><Input type="date" className="h-12 bg-muted/5 border-2 rounded-xl" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Expiry Date</FormLabel><FormControl><Input type="date" className="h-12 bg-muted/5 border-2 rounded-xl" value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={(e) => field.onChange(e.target.value)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="sharedWithTenant" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-2xl border-2 p-5 bg-primary/5 border-primary/10 hover:border-primary/30 transition-all cursor-pointer">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-1" /></FormControl>
                  <div className="space-y-1 text-left"><FormLabel className="font-bold text-sm text-primary">Share with Resident</FormLabel><FormDescription className="text-xs leading-tight">If enabled, the verified resident can download this from their hub.</FormDescription></div>
                </FormItem>
              )} />

              <div className="space-y-4">
                  <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Evidence Attachment</FormLabel>
                  {selectedFile ? (
                      <div className="flex items-center justify-between p-5 border-2 rounded-2xl bg-primary/5 border-primary/20 shadow-sm">
                          <div className="flex items-center gap-4 min-w-0"><div className="p-2.5 rounded-xl bg-primary/10 text-primary"><FileText className="h-6 w-6" /></div><div className="min-w-0"><p className="text-sm font-bold truncate">{selectedFile.name}</p><p className="text-[10px] font-bold uppercase opacity-40">Ready for sync</p></div></div>
                          <Button type="button" variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" onClick={() => setSelectedFile(null)}><X className="h-5 w-5" /></Button>
                      </div>
                  ) : documentRecord.fileUrl ? (
                      <div className="flex items-center justify-between p-5 border-2 rounded-2xl bg-muted/10 shadow-inner">
                          <div className="flex items-center gap-4"><div className="p-2.5 rounded-xl bg-background border shadow-sm text-muted-foreground"><FileText className="h-6 w-6" /></div><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current vault attachment</span></div>
                          <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg font-bold" asChild><a href={documentRecord.fileUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View</a></Button>
                              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg text-primary font-bold" onClick={() => document.getElementById('edit-file-upload')?.click()}>Replace</Button>
                          </div>
                      </div>
                  ) : (
                      <div className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer hover:bg-muted/10 hover:border-primary/20 transition-all" onClick={() => document.getElementById('edit-file-upload')?.click()}>
                          <FileUp className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-30" />
                          <p className="text-sm font-bold">Assign new file attachment</p>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1">PDF or high-res image</p>
                      </div>
                  )}
                  <input id="edit-file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,image/*" />
              </div>
              
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground px-1">Internal Audit Notes</FormLabel><FormControl><Textarea rows={4} className="resize-none border-2 bg-muted/5 rounded-2xl" placeholder="Add specific compliance notes..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <div className="flex justify-end gap-4 pt-6 border-t">
                  <Button type="button" variant="ghost" asChild className="font-bold uppercase tracking-widest text-[10px] h-12 px-8"><Link href="/dashboard/documents">Cancel Update</Link></Button>
                  <Button type="submit" disabled={isSaving} className="h-12 px-12 shadow-2xl font-bold uppercase tracking-widest text-[10px] bg-primary hover:bg-primary/90 rounded-xl transition-all">
                    {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synchronizing...</> : 'Complete Record Update'}
                  </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
