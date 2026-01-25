'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Link from 'next/link';
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
import { CalendarIcon, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

const documentSchema = z.object({
  title: z.string().min(3, 'Title is too short'),
  property: z.string({ required_error: 'Please select a property.' }),
  documentType: z.string({ required_error: 'Please select a document type.' }),
  issueDate: z.date({ required_error: 'Please select an issue date.' }),
  expiryDate: z.date({ required_error: 'Please select an expiry date.' }),
  documentFile: z.any().refine(files => files?.length > 0, 'File is required.'),
  notes: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

// Mock properties data
const properties = [
  { id: '1', address: '123 Oakhaven St' },
  { id: '2', address: '456 Maple Rd' },
  { id: '3', address: '789 Pine Ln' },
];

export default function UploadDocumentPage() {
  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
  });

  function onSubmit(data: DocumentFormValues) {
    toast({
      title: 'Document Uploaded',
      description: 'The document has been successfully uploaded.',
    });
    console.log(data);
    form.reset();
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
                name="property"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a property" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {properties.map((prop) => (
                            <SelectItem key={prop.id} value={prop.address}>
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
                    <Button asChild variant="outline" className="w-full">
                        <label className="cursor-pointer">
                            <Upload className="mr-2 h-4 w-4" />
                            Choose File
                            <Input type="file" className="sr-only" onChange={(e) => field.onChange(e.target.files)} />
                        </label>
                    </Button>
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
                <Button type="submit">Save Document</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
