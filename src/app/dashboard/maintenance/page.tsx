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
import { CalendarIcon, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';


// Schema for the form
const maintenanceSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }),
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  priority: z.string({ required_error: 'Please select a priority.' }),
  reportedBy: z.string().optional(),
  reportedDate: z.date(),
  contractorName: z.string().optional(),
  contractorPhone: z.string().optional(),
  scheduledDate: z.date().optional(),
  estimatedCost: z.coerce.number().optional(),
  photos: z.any().optional(),
  notes: z.string().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

// Type for property documents from Firestore
interface Property {
  address: string;
  ownerId: string;
}

// Type for maintenance log documents from Firestore
interface MaintenanceLog {
    propertyId: string;
    title: string;
    priority: string;
    status: string;
    reportedDate: { seconds: number; nanoseconds: number; } | Date; // Firestore timestamp or Date
    // Using propertyAddress for display purposes
    propertyAddress?: string;
}


export default function MaintenancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('');

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      reportedDate: new Date(),
    }
  });

  // Fetch properties for the dropdowns
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  // Fetch maintenance logs for the selected property
  const maintenanceQuery = useMemoFirebase(() => {
    if (!user || !selectedPropertyFilter) return null;
    return query(
        collection(firestore, 'properties', selectedPropertyFilter, 'maintenanceLogs'),
        where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyFilter]);

  const { data: maintenanceLogs, isLoading: isLoadingLogs } = useCollection<MaintenanceLog>(maintenanceQuery);

  async function onSubmit(data: MaintenanceFormValues) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in.',
      });
      return;
    }

    const newLog = {
      ...data,
      ownerId: user.uid,
      status: 'Open', // Default status
    };

    try {
      const logsCollection = collection(firestore, 'properties', data.propertyId, 'maintenanceLogs');
      await addDocumentNonBlocking(logsCollection, newLog);
      
      toast({
        title: 'Maintenance Logged',
        description: 'The new maintenance issue has been successfully logged.',
      });
      form.reset({ reportedDate: new Date() });
      // If no filter is set, set it to the property we just added a log for
      if (!selectedPropertyFilter) {
          setSelectedPropertyFilter(data.propertyId);
      }
    } catch (error) {
        console.error('Failed to log maintenance issue', error);
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'There was an error saving the maintenance log. Please try again.',
        });
    }
  }

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'destructive';
      case 'Urgent': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Log Maintenance Issue</CardTitle>
          <CardDescription>
            Fill in the details below to log a new maintenance issue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Issue Details Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Issue Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={isLoadingProperties ? 'Loading properties...' : 'Select a property'} />
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
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issue Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Leaking kitchen sink" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide a detailed description of the issue."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[
                                'Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other'
                              ].map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {['Emergency', 'Urgent', 'Routine', 'Low'].map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Reporting Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Reporting Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="reportedBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reported By</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Tenant name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reportedDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Reported Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                                >
                                  {field.value ? (format(field.value, 'PPP')) : (<span>Pick a date</span>)}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contractor Information Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Contractor Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contractorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contractor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., ABC Plumbers" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contractorPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contractor Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="07123456789" {...field} />
                          </FormControl>
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
                                <Button
                                  variant={'outline'}
                                  className={cn('pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
                                >
                                  {field.value ? (format(field.value, 'PPP')) : (<span>Pick a date</span>)}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estimatedCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Cost (£)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="150" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Photos & Notes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Upload Photos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="photos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Upload Photos of Issue</FormLabel>
                        <FormControl>
                          <Button asChild variant="outline" className="w-full">
                            <label className="cursor-pointer">
                              <Upload className="mr-2 h-4 w-4" />
                              Choose Files
                              <Input type="file" multiple className="sr-only" {...field} />
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
                  <CardTitle className='text-xl'>Additional Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional notes..."
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

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
                <Button type="submit">Log Maintenance</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Maintenance History</CardTitle>
          <CardDescription>View and manage logged maintenance issues for your properties.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
                <Label htmlFor="property-filter">Filter by Property</Label>
                <Select value={selectedPropertyFilter} onValueChange={setSelectedPropertyFilter}>
                    <SelectTrigger id="property-filter" className="w-full md:w-[300px]">
                        <SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property'} />
                    </SelectTrigger>
                    <SelectContent>
                        {properties?.map(prop => (
                            <SelectItem key={prop.id} value={prop.id}>{prop.address}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead className="text-right">Reported</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingLogs && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoadingLogs && maintenanceLogs?.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    {selectedPropertyFilter ? 'No maintenance logs for this property.' : 'Select a property to view logs.'}
                                </TableCell>
                            </TableRow>
                        )}
                        {maintenanceLogs?.map(log => (
                            <TableRow key={log.id}>
                                <TableCell className="font-medium">{log.title}</TableCell>
                                <TableCell><Badge>{log.status}</Badge></TableCell>
                                <TableCell><Badge variant={getPriorityVariant(log.priority)}>{log.priority}</Badge></TableCell>
                                <TableCell className="text-right">
                                    {log.reportedDate instanceof Date ? format(log.reportedDate, 'dd/MM/yyyy') : format(new Date(log.reportedDate.seconds * 1000), 'dd/MM/yyyy')}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
        </CardContent>
       </Card>
    </div>
  );
}
