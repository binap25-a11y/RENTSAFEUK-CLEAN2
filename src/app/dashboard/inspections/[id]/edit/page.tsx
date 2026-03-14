'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Loader2, ArrowLeft, Save, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useDoc, useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { doc, updateDoc, collection, query, where, limit, addDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { generateInspectionPDF } from '@/lib/generate-inspection-pdf';
import { uploadPropertyDocument } from '@/lib/upload-document';
import { format } from 'date-fns';

const ChecklistItem = ({ form, name, label }: { form: any, name: any, label: string }) => (
    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                    <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel className="font-normal">{label}</FormLabel>
                </div>
            </FormItem>
        )}
    />
);

const NotesField = ({ form, name, placeholder }: { form: any, name: any, placeholder: string }) => (
    <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
            <FormItem className="mt-4 col-span-1 md:col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                    <Textarea placeholder={placeholder} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
            </FormItem>
        )}
    />
);

const prepareForFirestore = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (value === undefined) return null;
        if (value && typeof value === 'object' && (value.constructor.name === 'FileList' || value.constructor.name === 'File')) return null;
        return value;
    }));
};

export default function EditInspectionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const propertyId = searchParams.get('propertyId');
  const firestore = useFirestore();
  const { user } = useUser();
  const [isSaving, setIsSaving] = useState(false);

  const inspectionRef = useMemoFirebase(() => {
    if (!firestore || !id || !user) return null;
    return doc(firestore, 'inspections', id);
  }, [firestore, id, user]);

  const { data: inspection, isLoading: isLoadingInspection } = useDoc(inspectionRef);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  const { data: property, isLoading: isLoadingProperty } = useDoc(propertyRef);

  const form = useForm();

  useEffect(() => {
    if (inspection) {
      const data = { ...inspection };
      if (data.scheduledDate?.seconds) data.scheduledDate = new Date(data.scheduledDate.seconds * 1000);
      if (data.completedDate?.seconds) data.completedDate = new Date(data.completedDate.seconds * 1000);
      if (data.followUp?.nextInspectionDate?.seconds) data.followUp.nextInspectionDate = new Date(data.followUp.nextInspectionDate.seconds * 1000);
      
      form.reset(data);
    }
  }, [inspection, form]);

  async function onSubmit(data: any) {
    if (!user || !firestore || !inspectionRef || !property || !propertyId) return;
    setIsSaving(true);

    try {
      const cleanedData = prepareForFirestore(data);
      await updateDoc(inspectionRef, cleanedData);
      
      // AUTO-PDF GENERATION WORKFLOW
      toast({ title: 'Changes Saved', description: 'Generating updated PDF report...' });
      const pdfDoc = generateInspectionPDF({ ...inspection, ...data }, property);
      
      // AUTO-UPLOAD TO RESIDENT HUB
      if (data.status === 'Completed' && pdfDoc) {
          try {
              const blob = pdfDoc.output('blob');
              const fileName = `Inspection-Update-${format(new Date(), 'yyyyMMdd')}-${propertyId.substring(0,5)}.pdf`;
              const file = new File([blob], fileName, { type: 'application/pdf' });
              const fileUrl = await uploadPropertyDocument(file, user.uid, propertyId);
              
              await addDoc(collection(firestore, 'documents'), {
                  title: `Inspection Report (Update) - ${data.inspectionType || 'Routine'} (${format(new Date(), 'dd/MM/yyyy')})`,
                  propertyId: propertyId,
                  landlordId: user.uid,
                  documentType: 'Inspection Report',
                  issueDate: new Date().toISOString(),
                  expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                  fileUrl,
                  isAutoGenerated: true,
                  inspectionId: id
              });
              toast({ title: 'Shared with Resident', description: 'Updated report uploaded to Resident Hub.' });
          } catch (uploadErr) {
              console.error("Auto-upload failure:", uploadErr);
              toast({ variant: 'destructive', title: 'Vault Sync Failed', description: 'Report saved but could not be shared automatically.' });
          }
      }
      
      router.push(`/dashboard/inspections/${id}?propertyId=${propertyId}`);
    } catch (error) {
      console.error('Failed to update inspection:', error);
      toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
      setIsSaving(false);
    }
  }

  const isLoading = isLoadingInspection || isLoadingProperty;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!inspection) {
    return <div className="text-center py-10">Inspection not found.</div>;
  }

  return (
    <div className="flex flex-col gap-6 text-left">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/inspections">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit {inspection.type} Report</h1>
          <p className="text-muted-foreground text-sm">Modify the inspection details and generate an updated PDF audit.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="inspectorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspector Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['Scheduled', 'Completed', 'Cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          <Accordion type="multiple" className="w-full space-y-4">
            {inspection.type === 'Single-Let' ? (
              <>
                <AccordionItem value="safety" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold">Safety & Compliance</AccordionTrigger>
                  <AccordionContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChecklistItem form={form} name="safety.smokeAlarms" label="Smoke alarms tested" />
                    <ChecklistItem form={form} name="safety.coAlarm" label="CO alarm tested" />
                    <ChecklistItem form={form} name="safety.gasCert" label="Gas safety valid" />
                    <ChecklistItem form={form} name="safety.eicr" label="EICR valid" />
                    <NotesField form={form} name="safety.notes" placeholder="Compliance notes..." />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="interior" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold">Interior Condition</AccordionTrigger>
                  <AccordionContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChecklistItem form={form} name="interior.noDamp" label="No signs of damp/mould" />
                    <ChecklistItem form={form} name="interior.cleanliness" label="General cleanliness" />
                    <NotesField form={form} name="interior.notes" placeholder="Interior notes..." />
                  </AccordionContent>
                </AccordionItem>
              </>
            ) : (
              <>
                <AccordionItem value="fire-safety" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold">HMO Fire Safety</AccordionTrigger>
                  <AccordionContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChecklistItem form={form} name="fireSafety.interlinkedAlarms" label="Interlinked alarms working" />
                    <ChecklistItem form={form} name="fireSafety.fireDoors" label="Fire doors self-closing" />
                    <ChecklistItem form={form} name="fireSafety.emergencyLighting" label="Emergency lighting operational" />
                    <NotesField form={form} name="fireSafety.notes" placeholder="Fire safety notes..." />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="communal" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold">Communal Areas</AccordionTrigger>
                  <AccordionContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChecklistItem form={form} name="communal.clean" label="Clean and hazard-free" />
                    <ChecklistItem form={form} name="communal.wasteDisposal" label="Waste disposal tidy" />
                    <NotesField form={form} name="communal.notes" placeholder="Communal area notes..." />
                  </AccordionContent>
                </AccordionItem>
              </>
            )}
          </Accordion>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/inspections">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSaving} className="h-11 px-8 font-bold uppercase tracking-widest text-[10px] shadow-lg">
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Save & Export PDF</>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
