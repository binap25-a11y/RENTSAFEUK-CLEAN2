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
import { Loader2, Upload, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useStorage,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

// Schema for the form, file input is handled separately
const maintenanceSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }).min(1, 'Please select a property.'),
  title: z.string().min(3, 'Title is too short'),
  description: z.string().optional(),
  category: z.string({ required_error: 'Please select a category.' }),
  priority: z.string({ required_error: 'Please select a priority.' }),
  reportedBy: z.string().optional(),
  reportedDate: z.coerce.date(),
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
}

export default function Maintenance2Page() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [photosToUpload, setPhotosToUpload] = useState<FileList | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);


  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      propertyId: '',
      title: '',
      description: '',
      category: 'Other',
      priority: 'Routine',
      reportedBy: '',
      notes: '',
      reportedDate: new Date(),
    },
  });

  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const formatAddress = (address: Property['address']) => {
    return [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setUploadedUrls([]); // Reset previous uploads if new files are selected
    setPhotosToUpload(files);
    if (files) {
      const fileArray = Array.from(files);
      const newPreviews = fileArray.map(file => URL.createObjectURL(file));
      setPhotoPreviews(newPreviews);
    } else {
      setPhotoPreviews([]);
    }
  };

  const handleUpload = async () => {
    if (!photosToUpload || photosToUpload.length === 0) {
      toast({ variant: 'destructive', title: 'No files selected', description: 'Please select one or more images to upload.' });
      return;
    }
    if (!user || !storage) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'Cannot upload files. Please sign in again.' });
        return;
    }

    setIsUploading(true);
    toast({ title: 'Uploading photos...', description: `Uploading ${photosToUpload.length} image(s).` });
    
    try {
        const uploadPromises = Array.from(photosToUpload).map(file => {
          const uniqueFileName = `${Date.now()}-${file.name}`;
          const fileStorageRef = storageRef(storage, `maintenance/${user.uid}/${uniqueFileName}`);
          return uploadBytes(fileStorageRef, file).then(snapshot => getDownloadURL(snapshot.ref));
        });

        const finalUploadedUrls = await Promise.all(uploadPromises);
        setUploadedUrls(finalUploadedUrls);
        toast({ title: 'Photo Upload Complete', description: 'Your images have been saved. You can now log the maintenance issue.' });
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
        description: 'You must be logged in to log an issue.',
      });
      return;
    }

    setIsSubmitting(true);
    toast({ title: 'Logging Maintenance...', description: 'Please wait while we save the details.' });

    try {
      const newLog = {
        ...data,
        ownerId: user.uid,
        status: 'Open',
        photoUrls: uploadedUrls, // Use the already uploaded URLs from state
      };

      const logsCollection = collection(firestore, 'properties', data.propertyId, 'maintenanceLogs');
      const docRef = await addDoc(logsCollection, newLog);

      toast({
        title: 'Maintenance Logged Successfully',
        description: 'The new issue has been created.',
      });
      
      router.push(`/dashboard/maintenance/${docRef.id}?propertyId=${data.propertyId}`);

    } catch (error) {
      console.error('Failed to log maintenance issue:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'There was an error saving the maintenance log. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Step 1: Upload Photos (Optional)</CardTitle>
                <CardDescription>First, select and upload any relevant photos of the maintenance issue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="file-upload">Select Photos</Label>
                    <Input
                        id="file-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isUploading}
                    />
                </div>

                {photoPreviews.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                        {photoPreviews.map((url, index) => (
                            <div key={index} className="relative aspect-square">
                                <Image src={url} alt={`Preview ${index + 1}`} fill className="rounded-md object-cover" />
                            </div>
                        ))}
                    </div>
                )}
                
                <Button onClick={handleUpload} disabled={isUploading || !photosToUpload || photosToUpload.length === 0}>
                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload Photos
                </Button>

                {uploadedUrls.length > 0 && (
                    <div className="flex items-center gap-2 text-green-600 font-medium pt-2">
                        <CheckCircle className="h-5 w-5" />
                        <p>Upload complete. You can now fill in the details below.</p>
                    </div>
                )}

            </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Log Maintenance Issue</CardTitle>
          <CardDescription>
            Fill in the details for the maintenance issue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                        <Textarea placeholder="Describe the issue in detail..." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

              <div className="flex justify-end gap-2">
                <Button type="submit" disabled={isSubmitting}>
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
    </div>
  );
}
