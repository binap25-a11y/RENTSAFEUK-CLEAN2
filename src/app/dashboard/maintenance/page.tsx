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
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
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
import { Upload, Loader2, Wand2, Search, MoreVertical, Edit, Eye, XCircle, Trash2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useStorage,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
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
import { MaintenanceAssistantDialog } from '@/components/dashboard/maintenance-assistant-dialog';
import type { MaintenanceAssistantOutput } from '@/ai/flows/maintenance-assistant-flow';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


// Schema for the form, file input is handled separately
const maintenanceSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Please select a property.'),
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  priority: z.string({ required_error: 'Please select a priority.' }),
  reportedBy: z.string().optional(),
  reportedDate: z.coerce.date(),
  contractorName: z.string().optional(),
  contractorPhone: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  estimatedCost: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

// Type for property documents from Firestore
interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
  ownerId: string;
}

// Type for maintenance log documents from Firestore
interface MaintenanceLog {
    id: string;
    propertyId: string;
    title: string;
    priority: string;
    status: string;
    reportedDate: { seconds: number; nanoseconds: number; } | Date; // Firestore timestamp or Date
    // Using propertyAddress for display purposes
    propertyAddress?: string;
}

// Type for contractor documents from Firestore
interface Contractor {
    id: string;
    name: string;
    phone: string;
    trade: string;
}


export default function MaintenancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photosToUpload, setPhotosToUpload] = useState<FileList | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [logToCancel, setLogToCancel] = useState<MaintenanceLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<MaintenanceLog | null>(null);

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      propertyId: '',
      title: '',
      description: '',
      category: '',
      priority: '',
      reportedBy: '',
      contractorName: '',
      contractorPhone: '',
      notes: '',
      reportedDate: new Date(),
      scheduledDate: undefined,
      estimatedCost: undefined,
    },
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
  
  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, prop) => {
        acc[prop.id] = [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ');
        return acc;
    }, {} as Record<string, string>);
  }, [properties]);
  
  // Fetch contractors for the dropdown
  const contractorsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'contractors'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: contractors } = useCollection<Contractor>(contractorsQuery);


  // Fetch maintenance logs for the selected property
  const maintenanceQuery = useMemoFirebase(() => {
    if (!user || !selectedPropertyFilter) return null;
    return query(
        collection(firestore, 'properties', selectedPropertyFilter, 'maintenanceLogs'),
        where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyFilter]);

  const { data: maintenanceLogs, isLoading: isLoadingLogs } = useCollection<MaintenanceLog>(maintenanceQuery);
  
  const filteredLogs = useMemo(() => {
    if (!maintenanceLogs) return [];
    if (!searchTerm) return maintenanceLogs;
    return maintenanceLogs.filter(log =>
        log.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
}, [maintenanceLogs, searchTerm]);

  const handleLogFromAssistant = (suggestion: MaintenanceAssistantOutput) => {
    form.setValue('title', suggestion.suggestedTitle);
    const description = `AI Diagnosis:\n- ${suggestion.likelyCause}\n\nSuggested Troubleshooting:\n- ${suggestion.troubleshootingSteps.join('\n- ')}`;
    form.setValue('description', description);
    form.setValue('priority', suggestion.urgency);
    form.setValue('category', suggestion.suggestedCategory);
    setIsAssistantOpen(false);
    toast({
      title: 'Form Pre-filled',
      description: 'The maintenance form has been pre-filled with the AI suggestions.',
    });
  };

  const handleUpload = async () => {
    if (!photosToUpload || photosToUpload.length === 0 || !user || !storage) return;

    setIsUploading(true);
    toast({ title: 'Uploading...', description: `Uploading ${photosToUpload.length} photo(s).` });

    try {
        const uploadPromises = Array.from(photosToUpload).map(async (file) => {
            const uniqueFileName = `${Date.now()}-${file.name}`;
            const fileStorageRef = storageRef(storage, `maintenance/${user.uid}/${uniqueFileName}`);
            await uploadBytes(fileStorageRef, file);
            return getDownloadURL(fileStorageRef);
        });
        const urls = await Promise.all(uploadPromises);
        setUploadedPhotoUrls(urls);
        toast({ title: 'Upload Successful', description: 'Photos are ready to be saved with the log.' });
    } catch (error) {
        console.error('Photo upload failed:', error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload photos. Please try again.' });
    } finally {
        setIsUploading(false);
    }
  };

  async function onSubmit(data: MaintenanceFormValues) {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
        const newLog = {
          ...data,
          ownerId: user.uid,
          status: 'Open',
          photoUrls: uploadedPhotoUrls,
        };

        const logsCollection = collection(firestore, 'properties', data.propertyId, 'maintenanceLogs');
        const newDocRef = await addDoc(logsCollection, newLog);
        
        toast({
          title: 'Maintenance Logged',
          description: 'The new maintenance issue has been successfully logged.',
        });
        router.push(`/dashboard/maintenance/${newDocRef.id}?propertyId=${data.propertyId}`);

    } catch (error) {
        console.error('Failed to log maintenance issue', error);
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'There was an error saving the maintenance log. Please try again.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleStatusChange = async (logId: string, propertyId: string, newStatus: string) => {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Database Error',
        description: 'Firestore not available.',
      });
      return;
    }
    try {
      const logRef = doc(firestore, 'properties', propertyId, 'maintenanceLogs', logId);
      await updateDoc(logRef, { status: newStatus });
      toast({
        title: 'Status Updated',
        description: 'The maintenance log status has been updated.',
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'There was an error updating the status. Please try again.',
      });
    }
  };

  const handleCancelConfirm = async () => {
    if (!firestore || !logToCancel) return;
    try {
      const logRef = doc(firestore, 'properties', logToCancel.propertyId, 'maintenanceLogs', logToCancel.id);
      await updateDoc(logRef, { status: 'Cancelled' });
      toast({
        title: 'Maintenance Log Cancelled',
        description: `The log "${logToCancel.title}" has been marked as cancelled.`,
      });
    } catch (error) {
      console.error('Failed to cancel log:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'There was an error cancelling the log. Please try again.',
      });
    } finally {
      setLogToCancel(null);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!firestore || !logToDelete) return;
    try {
      const logRef = doc(firestore, 'properties', logToDelete.propertyId, 'maintenanceLogs', logToDelete.id);
      await deleteDoc(logRef);
      toast({
        title: 'Maintenance Log Deleted',
        description: `The log "${logToDelete.title}" has been permanently deleted.`,
      });
    } catch (error) {
      console.error('Failed to delete log:', error);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'There was an error deleting the log. Please try again.',
      });
    } finally {
      setLogToDelete(null);
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'destructive';
      case 'Urgent': return 'secondary';
      default: return 'outline';
    }
  };
  
  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  return (
    <>
      <div className="space-y-6">
        <MaintenanceAssistantDialog 
            isOpen={isAssistantOpen} 
            onOpenChange={setIsAssistantOpen}
            onLogIssue={handleLogFromAssistant}
        />
        <Card>
          <CardHeader>
            <CardTitle>Log Maintenance Issue</CardTitle>
            <CardDescription>
              Fill in the details below or use our AI assistant to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <Button onClick={() => setIsAssistantOpen(true)} variant="outline">
                  <Wand2 className="mr-2 h-4 w-4" />
                  AI Assistant
              </Button>
            </div>
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingProperties ? 'Loading properties...' : 'Select a property'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {properties?.map((prop) => (
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
                            <Select onValueChange={field.onChange} value={field.value}>
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
                            <Select onValueChange={field.onChange} value={field.value}>
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
                          <FormItem>
                            <FormLabel>Reported Date</FormLabel>
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
                  </CardContent>
                </Card>

                {/* Contractor Information Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Contractor Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormItem>
                        <FormLabel>Select a saved contractor</FormLabel>
                        <Select onValueChange={(contractorId) => {
                            const contractor = contractors?.find(c => c.id === contractorId);
                            if (contractor) {
                                form.setValue('contractorName', contractor.name);
                                form.setValue('contractorPhone', contractor.phone);
                            }
                        }}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select from your directory" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contractors?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} ({c.trade})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Or enter new contractor details below.
                        </FormDescription>
                      </FormItem>
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
                          <FormItem>
                            <FormLabel>Scheduled Date</FormLabel>
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
                        name="estimatedCost"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estimated Cost (£)</FormLabel>
                            <FormControl>
                              <Input type="text" inputMode="decimal" placeholder="150.00" {...field} onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} value={field.value ?? ''} />
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
                    <CardTitle className="text-xl">Photos &amp; Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Upload Photos of Issue</Label>
                        <Input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => {
                            const files = e.target.files;
                            setPhotosToUpload(files);
                            setUploadedPhotoUrls([]); // Reset on new selection
                            if (files) {
                              const fileArray = Array.from(files);
                              const newPreviews = fileArray.map(file => URL.createObjectURL(file));
                              setPhotoPreviews(newPreviews);
                            }
                          }}
                        />
                         {photoPreviews.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                                {photoPreviews.map((url, index) => (
                                    <div key={index} className="relative aspect-square">
                                        <Image src={url} alt={`Preview ${index + 1}`} fill className="rounded-md object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleUpload}
                                disabled={!photosToUpload || photosToUpload.length === 0 || isUploading || uploadedPhotoUrls.length > 0}
                            >
                                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Upload Photo(s)
                            </Button>
                            {uploadedPhotoUrls.length > 0 && (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">Upload Complete</span>
                                </div>
                            )}
                        </div>
                    </div>
                     <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes</FormLabel>
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
                  <Button type="button" variant="outline" onClick={() => form.reset()}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || isUploading}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging...
                      </>
                    ) : (
                      'Log Maintenance'
                    )}
                  </Button>
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
              <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex items-center gap-2">
                      <Label htmlFor="property-filter" className="sr-only">Filter by Property</Label>
                      <Select value={selectedPropertyFilter} onValueChange={setSelectedPropertyFilter}>
                          <SelectTrigger id="property-filter" className="w-full md:w-[300px]">
                              <SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property'} />
                          </SelectTrigger>
                          <SelectContent>
                              {properties?.map(prop => (
                                  <SelectItem key={prop.id} value={prop.id}>{formatAddress(prop.address)}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="relative w-full md:max-w-sm">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                          placeholder="Search by issue title..." 
                          className="pl-8" 
                          value={searchTerm} 
                          onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden rounded-md border md:block">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Title</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Priority</TableHead>
                              <TableHead>Reported</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {isLoadingLogs && (
                              <TableRow>
                                  <TableCell colSpan={5} className="h-24 text-center">
                                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                  </TableCell>
                              </TableRow>
                          )}
                          {!isLoadingLogs && filteredLogs?.length === 0 && (
                              <TableRow>
                                  <TableCell colSpan={5} className="h-24 text-center">
                                      {selectedPropertyFilter ? 'No maintenance logs for this property.' : 'Select a property to view logs.'}
                                  </TableCell>
                              </TableRow>
                          )}
                          {filteredLogs?.map(log => (
                              <TableRow key={log.id}>
                                  <TableCell className="font-medium">
                                      <Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`} className="hover:underline">
                                          {log.title}
                                      </Link>
                                  </TableCell>
                                  <TableCell>
                                      <Select
                                          value={log.status}
                                          onValueChange={(newStatus) => handleStatusChange(log.id, selectedPropertyFilter, newStatus)}
                                      >
                                          <SelectTrigger className="w-[150px]">
                                              <SelectValue placeholder="Set status" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              <SelectItem value="Open">Open</SelectItem>
                                              <SelectItem value="In Progress">In Progress</SelectItem>
                                              <SelectItem value="Completed">Completed</SelectItem>
                                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                                          </SelectContent>
                                      </Select>
                                  </TableCell>
                                  <TableCell><Badge variant={getPriorityVariant(log.priority)}>{log.priority}</Badge></TableCell>
                                  <TableCell>
                                      {log.reportedDate instanceof Date ? format(log.reportedDate, 'dd/MM/yyyy') : format(new Date(log.reportedDate.seconds * 1000), 'dd/MM/yyyy')}
                                  </TableCell>
                                  <TableCell className="text-right">
                                      <Button asChild variant="ghost" size="icon">
                                          <Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`}>
                                              <Eye className="h-4 w-4" />
                                          </Link>
                                      </Button>
                                      <Button asChild variant="ghost" size="icon">
                                        <Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${selectedPropertyFilter}`}>
                                          <Edit className="h-4 w-4" />
                                        </Link>
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => setLogToCancel(log)}>
                                          <XCircle className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" onClick={() => setLogToDelete(log)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </div>

              {/* Mobile Card View */}
              <div className="space-y-4 md:hidden">
                {isLoadingLogs ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredLogs?.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        {selectedPropertyFilter ? 'No maintenance logs for this property.' : 'Select a property to view logs.'}
                    </div>
                ) : (
                  filteredLogs.map(log => (
                      <Card key={log.id}>
                          <CardHeader>
                              <div className="flex justify-between items-start">
                                  <div>
                                      <CardTitle className="text-base pr-2">
                                          <Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`} className="hover:underline">
                                              {log.title}
                                          </Link>
                                      </CardTitle>
                                      <CardDescription>{propertyMap[selectedPropertyFilter]}</CardDescription>
                                  </div>
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="-mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/dashboard/maintenance/${log.id}?propertyId=${selectedPropertyFilter}`}>
                                                    <Eye className="mr-2 h-4 w-4" /> View
                                                </Link>
                                            </DropdownMenuItem>
                                          <DropdownMenuItem asChild>
                                              <Link href={`/dashboard/maintenance/${log.id}/edit?propertyId=${selectedPropertyFilter}`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setLogToCancel(log)}>
                                              <XCircle className="mr-2 h-4 w-4" /> Cancel Log
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => setLogToDelete(log)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                              <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Status</span>
                                <Select
                                      value={log.status}
                                      onValueChange={(newStatus) => handleStatusChange(log.id, selectedPropertyFilter, newStatus)}
                                  >
                                      <SelectTrigger className="w-[150px] h-9">
                                          <SelectValue placeholder="Set status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          <SelectItem value="Open">Open</SelectItem>
                                          <SelectItem value="In Progress">In Progress</SelectItem>
                                          <SelectItem value="Completed">Completed</SelectItem>
                                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                  </Select>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Priority</span>
                                  <Badge variant={getPriorityVariant(log.priority)}>{log.priority}</Badge>
                              </div>
                          </CardContent>
                          <CardFooter className="text-xs justify-end text-muted-foreground pt-4">
                              Reported on {log.reportedDate instanceof Date ? format(log.reportedDate, 'dd/MM/yyyy') : format(new Date(log.reportedDate.seconds * 1000), 'dd/MM/yyyy')}
                          </CardFooter>
                      </Card>
                  ))
                )}
              </div>
          </CardContent>
        </Card>
      </div>

       <AlertDialog open={!!logToCancel} onOpenChange={(open) => !open && setLogToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the maintenance log: "{logToCancel?.title}". This action can be undone by editing the log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelConfirm}
            >
              Yes, Cancel Log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the maintenance log: "{logToDelete?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
