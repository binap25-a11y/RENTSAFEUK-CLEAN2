
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Bed, 
  Bath, 
  Edit, 
  Trash2, 
  MoreVertical, 
  Loader2, 
  Home, 
  MapPin, 
  AlertCircle,
  PlusCircle,
  ChevronRight,
  Images,
  Banknote,
  Shield,
  FileText,
  User,
  Mail,
  Phone,
  Upload,
  X,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo, useRef } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { uploadPropertyImage } from '@/lib/upload-image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Property {
    id: string;
    landlordId: string;
    address: {
      nameOrNumber?: string;
      street: string;
      city: string;
      county?: string;
      postcode: string;
    };
    propertyType: string;
    status: string;
    bedrooms: number;
    bathrooms: number;
    imageUrl?: string;
    additionalImageUrls?: string[];
    notes?: string;
    tenancy?: {
        monthlyRent?: number;
        depositAmount?: number;
        depositScheme?: string;
    };
}

interface Tenant {
    id: string;
    name: string;
    email: string;
    telephone: string;
    propertyId: string;
    userId: string;
    status?: string;
}

interface Repair {
    id: string;
    title: string;
    status: string;
    reportedDate: any;
}

interface Inspection {
    id: string;
    type: string;
    status: string;
    scheduledDate: any;
}

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: any;
    tenantId: string;
}

export default function PropertyDetailPage() {
  const params = useParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMediaUpdating, setIsMediaUpdating] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const identityInputRef = useRef<HTMLInputElement>(null);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  
  const { data: property, isLoading: isLoadingProperty, error: propertyError } = useDoc<Property>(propertyRef);
  
  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !propertyId) return null;
    return query(
      collection(firestore, 'tenants'),
      where('landlordId', '==', user.uid),
      where('propertyId', '==', propertyId),
      where('status', '==', 'Active')
    );
  }, [firestore, user, propertyId]);
  const { data: activeTenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

  const repairsQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
        collection(firestore, 'repairs'), 
        where('landlordId', '==', user.uid),
        where('propertyId', '==', propertyId)
    );
  }, [firestore, propertyId, user]);
  const { data: repairs } = useCollection<Repair>(repairsQuery);

  const inspectionQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
        collection(firestore, 'inspections'), 
        where('landlordId', '==', user.uid),
        where('propertyId', '==', propertyId)
    );
  }, [firestore, propertyId, user]);
  const { data: inspections } = useCollection<Inspection>(inspectionQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
        collection(firestore, 'messages'),
        where('propertyId', '==', propertyId),
        orderBy('timestamp', 'desc'),
        limit(50)
    );
  }, [firestore, propertyId, user]);
  const { data: messages } = useCollection<Message>(messagesQuery);

  const activeRepairs = useMemo(() => {
    return repairs?.filter(log => log.status === 'Open' || log.status === 'In Progress') || [];
  }, [repairs]);

  const scheduledInspections = useMemo(() => {
    return inspections?.filter(insp => insp.status === 'Scheduled') || [];
  }, [inspections]);

  const openRepairsCount = activeRepairs.length;

  const handleMediaAction = async (action: 'upload' | 'delete' | 'promote', url?: string, files?: FileList | null) => {
    if (!user || !property || !propertyRef) return;
    setIsMediaUpdating(true);

    try {
      let updatedImageUrl = property.imageUrl || '';
      let updatedGallery = property.additionalImageUrls || [];

      if (action === 'upload' && files) {
        const fileArray = Array.from(files);
        const uploadPromises = fileArray.map(file => uploadPropertyImage(file, user.uid, property.id));
        const newUrls = await Promise.all(uploadPromises);
        const validUrls = newUrls.filter((u): u is string => !!u);
        updatedGallery = [...updatedGallery, ...validUrls];
        toast({ title: 'Photo Gallery Updated', description: `${validUrls.length} photos added successfully.` });
      }

      if (action === 'delete' && url) {
        updatedGallery = updatedGallery.filter(u => u !== url);
        if (updatedImageUrl === url) {
          updatedImageUrl = updatedGallery[0] || '';
        }
        toast({ title: 'Photo Removed' });
      }

      if (action === 'promote') {
        if (files && files[0]) {
          const file = files[0];
          const newUrl = await uploadPropertyImage(file, user.uid, property.id);
          if (newUrl) {
            updatedImageUrl = newUrl;
            updatedGallery = [newUrl, ...updatedGallery];
            toast({ title: 'Identity Photo Updated' });
          }
        } else if (url) {
          updatedImageUrl = url;
          if (!updatedGallery.includes(url)) {
              updatedGallery = [url, ...updatedGallery];
          }
          toast({ title: 'Identity Photo Set', description: 'This image is now the primary property photo.' });
        }
      }

      await updateDoc(propertyRef, {
        imageUrl: updatedImageUrl,
        additionalImageUrls: Array.from(new Set(updatedGallery))
      });

    } catch (err: any) {
      console.error('Media sync failed:', err);
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message });
    } finally {
      setIsMediaUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !property) return;
    try {
      await updateDoc(doc(firestore, 'properties', propertyId), { status: 'Deleted' });
      toast({ title: 'Property Archived', description: `${property.address.street} moved to archived records.` });
      router.push('/dashboard/properties');
    } catch (e) {
      console.error('Error archiving property:', e);
      toast({ variant: 'destructive', title: 'Action Failed' });
    } finally { setIsDeleting(false); }
  };
  
  const safeFormatDate = (date: any, formatStr: string) => {
    if (!date) return 'N/A';
    let jsDate: Date;
    if (date instanceof Date) jsDate = date;
    else if (typeof date === 'object' && (date as any).seconds !== undefined) jsDate = new Date((date as any).seconds * 1000);
    else jsDate = new Date(date);
    if (isNaN(jsDate.getTime())) return 'Invalid Date';
    try { return format(jsDate, formatStr); } catch (e) { return 'Invalid Date'; }
  };

  if (isLoadingProperty) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse font-medium">Resolving Asset Profile...</p>
      </div>
    );
  }

  if (propertyError || !property) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive opacity-20" />
        <h2 className="text-lg font-bold">Asset Access Error</h2>
        <p className="text-sm text-muted-foreground">This property may have been archived or moved.</p>
        <Button asChild variant="outline"><Link href="/dashboard/properties">Return to Portfolio</Link></Button>
      </div>
    );
  }

  const propertyAddressTitle = [property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ');
  const propertyAddressSubtitle = [property.address.city, property.address.county, property.address.postcode].filter(Boolean).join(', ');

  return (
    <>
      <div className="flex flex-col gap-6 text-left">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-hidden text-left">
                <Button variant="outline" size="icon" asChild className="shrink-0"><Link href="/dashboard/properties"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div className="min-w-0 text-left">
                    <h1 className="text-2xl font-bold font-headline leading-tight break-words text-left">{propertyAddressTitle}</h1>
                    <div className="flex items-center flex-wrap gap-2 mt-1">
                        <p className="text-muted-foreground text-sm font-medium">{propertyAddressSubtitle}</p>
                        {openRepairsCount > 0 && (
                            <Badge variant="destructive" className="h-5 px-1.5 gap-1 animate-pulse shrink-0">
                                <AlertCircle className="h-3 w-3" />
                                {openRepairsCount} Open Repairs
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2 shrink-0 h-11 px-6 font-bold uppercase tracking-widest text-xs shadow-sm">
                            <MoreVertical className="h-4 w-4" />
                            <span>Manage Asset</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1">
                        <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/dashboard/properties/${property.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Details
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => identityInputRef.current?.click()} disabled={isMediaUpdating} className="cursor-pointer">
                            <Upload className="mr-2 h-4 w-4" /> {isMediaUpdating ? 'Processing...' : 'Change Identity Photo'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive cursor-pointer font-bold">
                            <Trash2 className="mr-2 h-4 w-4" /> Archive Asset
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <input type="file" ref={identityInputRef} className="hidden" accept="image/*" onChange={(e) => handleMediaAction('promote', undefined, e.target.files)} />
            </div>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg overflow-hidden border-none bg-card">
              <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-headline text-lg">Property Profile</CardTitle>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 font-bold uppercase tracking-wider text-[10px]">{property.propertyType}</Badge>
                  </div>
              </CardHeader>
              <CardContent className="space-y-6 p-0">
                  <div className="px-6 pb-6">
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-md border-2 bg-muted mb-6 group">
                        {property.imageUrl ? (
                            <Image 
                              key={property.imageUrl}
                              src={property.imageUrl} 
                              alt="Asset Identity" 
                              fill 
                              className="object-cover group-hover:scale-105 transition-transform duration-700" 
                              priority 
                              unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary/20">
                                <div className="flex flex-col items-center">
                                    <Home className="h-16 w-16 mb-2 opacity-10" />
                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Identity Photo Pending</p>
                                </div>
                            </div>
                        )}
                        {isMediaUpdating && (
                          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                            <p className="text-white text-[10px] font-bold uppercase tracking-widest">Syncing Portfolio...</p>
                          </div>
                        )}
                        <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="secondary" size="sm" className="shadow-lg font-bold" onClick={() => identityInputRef.current?.click()} disabled={isMediaUpdating}>
                                {isMediaUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Change
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
                                <Images className="h-3.5 w-3.5 text-primary" />
                                Photo Gallery
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5" onClick={() => galleryInputRef.current?.click()} disabled={isMediaUpdating}>
                                {isMediaUpdating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <PlusCircle className="mr-2 h-3 w-3" />}
                                Add Photos
                            </Button>
                            <input type="file" ref={galleryInputRef} className="hidden" multiple accept="image/*" onChange={(e) => handleMediaAction('upload', undefined, e.target.files)} />
                        </div>
                        
                        {property.additionalImageUrls && property.additionalImageUrls.length > 0 ? (
                            <ScrollArea className="w-full whitespace-nowrap">
                                <div className="flex w-max space-x-4 pb-4 px-1">
                                    {property.additionalImageUrls.map((url, idx) => (
                                        <div key={idx} className="relative h-24 w-40 rounded-xl overflow-hidden border shadow-sm group bg-background">
                                            <Image 
                                              src={url} 
                                              alt={`Gallery Item ${idx + 1}`} 
                                              fill 
                                              className="object-cover" 
                                              unoptimized
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                                <Button 
                                                    size="icon" 
                                                    variant="secondary" 
                                                    className="h-7 w-7 rounded-full shadow-lg" 
                                                    title="Set as Primary"
                                                    onClick={() => handleMediaAction('promote', url)}
                                                    disabled={isMediaUpdating || property.imageUrl === url}
                                                >
                                                    <CheckCircle2 className={url === property.imageUrl ? "h-4 w-4 text-green-600" : "h-4 w-4"} />
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="destructive" 
                                                    className="h-7 w-7 rounded-full shadow-lg" 
                                                    title="Delete Photo"
                                                    onClick={() => handleMediaAction('delete', url)}
                                                    disabled={isMediaUpdating}
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        ) : (
                            <div className="border-2 border-dashed rounded-xl p-8 text-center bg-muted/5">
                                <p className="text-xs text-muted-foreground font-medium italic">No additional photos uploaded.</p>
                            </div>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-8 border-t pt-8 bg-muted/10">
                      <div className="p-4 rounded-xl bg-background border flex flex-col items-center gap-1 shadow-sm">
                          <Home className="h-5 w-5 text-primary mb-1 opacity-70" />
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Unit Type</span>
                          <span className="text-sm font-bold">{property.propertyType}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-background border flex flex-col items-center gap-1 shadow-sm">
                          <Bed className="h-5 w-5 text-primary mb-1 opacity-70" />
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bedrooms</span>
                          <span className="text-sm font-bold">{property.bedrooms}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-background border flex flex-col items-center gap-1 shadow-sm">
                          <Bath className="h-5 w-5 text-primary mb-1 opacity-70" />
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bathrooms</span>
                          <span className="text-sm font-bold">{property.bathrooms}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-background border flex flex-col items-center gap-1 shadow-sm">
                          <Badge variant={property.status === 'Occupied' ? 'default' : 'secondary'} className="mb-1 text-[10px] uppercase font-bold">{property.status}</Badge>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Status</span>
                      </div>
                  </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
                    <TabsTrigger value="overview" className="px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px]">Overview</TabsTrigger>
                    <TabsTrigger value="messages" className="px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] gap-2">
                        <MessageSquare className="h-3 w-3" />
                        Resident Messages
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-6 pt-4">
                    {property.tenancy && (property.tenancy.monthlyRent || property.tenancy.depositAmount) && (
                    <Card className="shadow-md border-none overflow-hidden text-left">
                        <CardHeader className="pb-4 bg-primary/[0.02] border-b border-primary/5 text-left"><CardTitle className="font-headline text-lg">Financial Overview</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 px-8 pb-8 text-left">
                        {property.tenancy.monthlyRent && (
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-2xl bg-primary/5 shrink-0"><Banknote className="h-6 w-6 text-primary" /></div>
                                <div className="text-left"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Monthly Rent</p><p className="text-xl font-bold">£{property.tenancy.monthlyRent.toLocaleString()}</p></div>
                            </div>
                        )}
                        {property.tenancy.depositAmount && (
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-2xl bg-primary/5 shrink-0"><Shield className="h-6 w-6 text-primary" /></div>
                                <div className="text-left"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Deposit Held</p><p className="text-xl font-bold">£{property.tenancy.depositAmount.toLocaleString()}</p></div>
                            </div>
                        )}
                        {property.tenancy.depositScheme && (
                            <div className="flex items-start gap-4 min-w-0">
                                <div className="p-3 rounded-2xl bg-primary/5 shrink-0"><FileText className="h-6 w-6 text-primary" /></div>
                                <div className="min-w-0 text-left"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Scheme</p><p className="font-bold truncate">{property.tenancy.depositScheme}</p></div>
                            </div>
                        )}
                        </CardContent>
                    </Card>
                    )}
                </TabsContent>
                <TabsContent value="messages" className="pt-4">
                    <Card className="shadow-md border-none overflow-hidden text-left">
                        <CardHeader className="pb-4 bg-primary/[0.02] border-b border-primary/5 text-left">
                            <CardTitle className="font-headline text-lg">Communication Registry</CardTitle>
                            <CardDescription>Review the latest interactions from verified residents.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 px-6 pb-6 text-left">
                            {!messages?.length ? (
                                <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/5">
                                    <MessageSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4" />
                                    <p className="text-sm text-muted-foreground font-medium italic">No message history found for this asset.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {messages.map((msg) => {
                                        const date = msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000) : new Date();
                                        const isLandlord = msg.senderId === user?.uid;
                                        return (
                                            <div key={msg.id} className={cn("flex flex-col gap-1 max-w-[90%]", isLandlord ? "ml-auto items-end" : "mr-auto items-start")}>
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{isLandlord ? 'You (Landlord)' : msg.senderName}</span>
                                                    <span className="text-[9px] font-medium text-muted-foreground/60">{format(date, 'dd MMM, HH:mm')}</span>
                                                </div>
                                                <div className={cn(
                                                    "p-3 rounded-xl text-sm font-medium shadow-sm leading-relaxed",
                                                    isLandlord ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none border"
                                                )}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
          </div>
          
          <div className="space-y-6">
            <Card className="shadow-md border-none overflow-hidden text-left">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-muted/20 border-b text-left">
                <CardTitle className="font-headline text-lg">Tenants</CardTitle>
                <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:bg-primary/5">
                  <Link href={`/dashboard/tenants/add?propertyId=${propertyId}`} title="New Tenancy"><PlusCircle className="h-5 w-5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-6 bg-muted/5 text-left">
                {isLoadingTenants ? (
                  <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" /></div>
                ) : activeTenants && activeTenants.length > 0 ? (
                  <div className="space-y-4">
                    {activeTenants.map((tenant) => (
                      <div key={tenant.id} className="p-4 rounded-xl bg-background border-2 border-transparent shadow-sm hover:border-primary/20 transition-all group text-left">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-full bg-primary/10 text-primary"><User className="h-4 w-4" /></div>
                            <p className="font-bold truncate max-w-[140px] text-left">{tenant.name}</p>
                          </div>
                          <Button variant="ghost" size="icon" asChild className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link href={`/dashboard/tenants/${tenant.id}?propertyId=${propertyId}`}><ChevronRight className="h-4 w-4" /></Link>
                          </Button>
                        </div>
                        <div className="space-y-2 text-left">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{tenant.email}</span></div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{tenant.telephone}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-muted-foreground mb-6 italic">No active tenants recorded.</p>
                    <Button asChild variant="secondary" className="w-full shadow-sm font-bold text-xs uppercase h-11"><Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}>Assign Tenant</Link></Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="shadow-sm border-none overflow-hidden bg-muted/5 text-left">
              <CardHeader className="pb-4 bg-muted/20 border-b text-left"><CardTitle className="font-headline text-lg">Location</CardTitle></CardHeader>
              <CardContent className="p-0 border-t">
                  {property.address && property.address.postcode ? (
                    <div className="aspect-square w-full rounded-2xl overflow-hidden border shadow-inner bg-muted/20">
                        <iframe 
                          width="100%" 
                          height="100%" 
                          style={{ border: 0, filter: 'none !important' }} 
                          className="color-map"
                          title="Map" 
                          loading="lazy" 
                          src={`https://maps.google.com/maps?q=${encodeURIComponent([property.address.street, property.address.city, property.address.postcode].filter(Boolean).join(', '))}&output=embed`}
                        ></iframe>
                    </div>
                  ) : <p className="text-xs text-muted-foreground text-center py-10 italic">Location data missing.</p>}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none overflow-hidden text-left">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-muted/20 border-b text-left">
                  <CardTitle className="font-headline text-lg">Timeline</CardTitle>
                  <Button variant="ghost" size="sm" asChild className="text-[10px] font-bold uppercase h-8"><Link href={`/dashboard/maintenance/logged?propertyId=${propertyId}`}>View All</Link></Button>
              </CardHeader>
              <CardContent className="pt-6 bg-muted/5 text-left">
                {(activeRepairs.length === 0 && scheduledInspections.length === 0) ? (
                  <p className="text-[10px] text-muted-foreground text-center py-6 italic uppercase tracking-wider">No active events</p>
                ) : (
                  <div className="space-y-4">
                    {activeRepairs.slice(0, 3).map(repair => (
                      <div key={repair.id} className="text-sm border-l-4 border-destructive pl-4 py-2 bg-background rounded-r-xl shadow-sm text-left">
                        <Link href={`/dashboard/maintenance/${repair.id}?propertyId=${propertyId}`} className="font-bold hover:text-primary transition-colors line-clamp-1 block text-left">{repair.title}</Link>
                        <div className="flex items-center gap-2 mt-1.5 text-left">
                            <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold">{repair.status}</Badge>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{safeFormatDate(repair.reportedDate, 'dd MMM')}</span>
                        </div>
                      </div>
                    ))}
                    {scheduledInspections.slice(0, 3).map(insp => (
                      <div key={insp.id} className="text-sm border-l-4 border-primary pl-4 py-2 bg-background rounded-r-xl shadow-sm text-left">
                        <Link href={`/dashboard/inspections/${insp.id}?propertyId=${propertyId}`} className="font-bold hover:text-primary transition-colors line-clamp-1 block text-left">{insp.type}</Link>
                        <div className="flex items-center gap-2 mt-1.5 text-left">
                            <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold">Scheduled</Badge>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{safeFormatDate(insp.scheduledDate, 'dd MMM')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl text-left">
          <AlertDialogHeader className="text-left">
              <AlertDialogTitle className="text-xl font-headline">Archive Property?</AlertDialogTitle>
              <AlertDialogDescription className="text-base font-medium">Move record at <strong className='text-foreground'>{property.address.street}</strong> to archives.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-xs h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase text-xs h-11 px-8" onClick={handleDeleteConfirm}>Archive Asset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
