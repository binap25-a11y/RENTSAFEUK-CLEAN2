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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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

const inspectionSchema = z.object({
  property: z.string({ required_error: 'Please select a property.' }),
  inspectionType: z.string({ required_error: 'Please select an inspection type.' }),
  status: z.string({ required_error: 'Please select a status.' }),
  scheduledDate: z.date(),
  completedDate: z.date().optional(),
  inspectorName: z.string().optional(),
  inspectorCompany: z.string().optional(),
  overallCondition: z.string().optional(),
  certificateNumber: z.string().optional(),
  certificateExpiryDate: z.date().optional(),
  cost: z.coerce.number().optional(),
  notes: z.string().optional(),
  report: z.any().optional(),
});

type InspectionFormValues = z.infer<typeof inspectionSchema>;

// Mock properties data
const properties = [
  { id: '1', address: '123 Oakhaven St' },
  { id: '2', address: '456 Maple Rd' },
  { id: '3', address: '789 Pine Ln' },
];

export default function InspectionsPage() {
  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
        scheduledDate: new Date(),
    },
  });

  function onSubmit(data: InspectionFormValues) {
    toast({
      title: 'Inspection Saved',
      description: 'The inspection details have been successfully saved.',
    });
    console.log(data);
    form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Inspection</CardTitle>
        <CardDescription>
          Fill in the details to schedule or record an inspection.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-8">
                {/* Inspection Details Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Inspection Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <FormField
                        control={form.control}
                        name="inspectionType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Inspection Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[
                                  'Move-in Inspection', 'Move-Out Inspection', 'Routine Inspection', 'Gas Safety Check', 'Electrical Safety', 'Legionella Risk', 'Fire Safety'
                                ].map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {['Scheduled', 'Completed', 'Cancelled'].map((p) => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
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
                            name="scheduledDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Scheduled Date</FormLabel>
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
                            name="completedDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Completed Date</FormLabel>
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
                        name="inspectorName"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Inspector Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Jane Smith" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="inspectorCompany"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Company</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., SafeHouse Inspections" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                  </CardContent>
                </Card>

                 {/* Results Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <FormField
                        control={form.control}
                        name="overallCondition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Overall Condition</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select condition" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {['Excellent', 'Good', 'Fair', 'Poor'].map((p) => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="certificateNumber"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Certificate Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g., GAS123456" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="certificateExpiryDate"
                            render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Certificate Expiry</FormLabel>
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
                        name="cost"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Cost (£)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="90" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Report & Notes Section */}
              <div className="space-y-8">
                 <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Upload Certificate/Report</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="report"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Upload File</FormLabel>
                          <FormControl>
                            <Button asChild variant="outline" className="w-full">
                                <label className="cursor-pointer">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Choose File
                                    <Input type="file" className="sr-only" {...field} />
                                </label>
                            </Button>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className='text-xl'>Findings / Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Summarize findings or any notes..."
                              className="resize-none"
                              rows={5}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Save Inspection</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
