'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  MoreVertical, 
  Loader2, 
  Home, 
  MapPin, 
  PlusCircle,
  ChevronRight,
  Images,
  Banknote,
  Shield,
  MessageSquare,
  Send,
  Clock,
  Building2,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  History,
  ChevronDown,
  RefreshCw,
  Users,
  Inbox,
  Wrench,
  UserMinus
} from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState, useRef, useEffect, useMemo } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { uploadPropertyImage } from '@/lib/upload-image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { safeToDate } from '@/lib/date-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { notifyTenantOfMessage } from '@/app/actions/notifications';

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

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: any;
    tenantId: string;
    landlordId: string;
    propertyId: string;
    tenantEmail?: string;
    read?: boolean;
}

export default function PropertyDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const propertyId = params.propertyId as string;
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isEndTenancyDialogOpen, setIsEndTenancyDialogOpen] = useState(false);
  const [isEndingTenancy, setIsEndingTenancy] = useState(false);
  const [isMediaUpdating, setIsMediaUpdating] = useState(false);
  const [newReply, setNewReply] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const identityInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'messages'].includes(tab)) {
        setActiveTab(tab);
    }
    const tenantIdParam = searchParams.get('tenantId');
    if (tenantIdParam) {
        setSelectedTenantId(tenantIdParam);
    }
  }, [searchParams]);

  const propertyRef = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return doc(firestore, 'properties', propertyId);
  }, [firestore, propertyId, user]);
  const { data: property, isLoading: isLoadingProperty } = useDoc<Property>(propertyRef);
  
  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !propertyId) return null;
    return query(
      collection(firestore, 'tenants'),
      where('landlordId', '==', user.uid),
      where('propertyId', '==', propertyId),
      where('status', '==', 'Active'),
      limit(10)
    );
  }, [firestore, user, propertyId]);
  const { data: activeTenants } = useCollection<Tenant>(tenantsQuery);

  useEffect(() => {
    if (activeTenants?.length && !selectedTenantId) {
        setSelectedTenantId(activeTenants[0].id);
    }
  }, [activeTenants, selectedTenantId]);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !propertyId || !user) return null;
    return query(
        collection(firestore, 'messages'),
        where('propertyId', '==', propertyId),
        where('landlordId', '==', user.uid),
        limit(200)
    );
  }, [firestore, propertyId, user]);

  const { data: rawMessages, isLoading: isLoadingMessages } = useCollection<Message>(messagesQuery);

  const messages = useMemo(() => {
    if (!rawMessages) return [];
    return rawMessages
        .filter(m => !selectedTenantId || m.tenantId === selectedTenantId)
        .sort((a, b) => (safeToDate(a.timestamp)?.getTime() || 0) - (safeToDate(b.timestamp)?.getTime() || 0));
  }, [rawMessages, selectedTenantId]);

  useEffect(() => {
    if (activeTab === 'messages' && messages.length > 0 && user) {
      const unreadIncoming = messages.filter(m => m.senderId !== user.uid && m.read !== true);
      unreadIncoming.forEach(msg => {
        updateDocumentNonBlocking(doc(firestore, 'messages', msg.id), { read: true });
      });
    }
  }, [activeTab, messages, user, firestore]);

  useEffect(() => {
    if (scrollRef.current && activeTab === 'messages') {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReply.trim() || !user || !property || isSendingReply || !selectedTenantId) return;

    const targetTenant = activeTenants?.find(t => t.id === selectedTenantId);
    if (!targetTenant) return;

    setIsSendingReply(true);
    const content = newReply.trim();
    const senderName = user.displayName || 'Management';

    try {
        await addDoc(collection(firestore, 'messages'), {
            landlordId: user.uid,
            propertyId: property.id,
            tenantId: targetTenant.id,
            tenantUid: targetTenant.userId || '',
            tenantEmail: targetTenant.email.toLowerCase().trim(),
            senderId: user.uid,
            senderName: senderName,
            content: content,
            timestamp: serverTimestamp(),
            read: false
        });
        
        // ASYNC NOTIFICATION: Notify tenant of message
        const propertyAddr = [property.address.nameOrNumber, property.address.street].filter(Boolean).join(' ') || 'your property';
        notifyTenantOfMessage(targetTenant.email, senderName, content, propertyAddr)
            .catch(err => console.warn("Tenant notification failed:", err.message));

        setNewReply('');
        toast({ title: 'Message Sent' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Sync Failed' });
    } finally {
        setIsSendingReply(false);
    }
  };

  const handleMediaAction = async (action: 'upload' | 'delete' | 'promote', url?: string, files?: FileList | null) => {
    if (!user || !property || !propertyRef) return;
    setIsMediaUpdating(true);
    try {
      let updatedImageUrl = property.imageUrl || '';
      let updatedGallery = property.additionalImageUrls || [];
      if (action === 'upload' && files) {
        const newUrls = await Promise.all(Array.from(files).map(f => uploadPropertyImage(f, user.uid, property.id)));
        updatedGallery = [...updatedGallery, ...newUrls.filter(Boolean)];
      }
      if (action === 'delete' && url) updatedGallery = updatedGallery.filter(u => u !== url);
      if (action === 'promote' && url) updatedImageUrl = url;
      await updateDoc(propertyRef, { imageUrl: updatedImageUrl, additionalImageUrls: Array.from(new Set(updatedGallery)) });
      toast({ title: 'Registry Updated' });
    } catch (err) { toast({ variant: 'destructive', title: 'Sync Error' }); } finally { setIsMediaUpdating(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!firestore || !user || !property) return;
    setIsArchiving(true);
    try {
      await updateDoc(doc(firestore, 'properties', propertyId), { status: 'Deleted' });
      toast({ title: 'Asset Archived' });
      router.push('/dashboard/properties');
    } catch (e) { toast({ variant: 'destructive', title: 'Action Failed' }); } finally { setIsArchiving(false); }
  };

  const handleEndTenancyConfirm = async () => {
    if (!firestore || !user || !property || !activeTenants) return;
    setIsEndingTenancy(true);
    try {
      // 1. Archive all active tenants for this property
      const batchPromises = activeTenants.map(t => 
        updateDoc(doc(firestore, 'tenants', t.id), { status: 'Archived' })
      );
      
      // 2. Update the property record to Vacant
      const propUpdatePromise = updateDoc(doc(firestore, 'properties', propertyId), {
        status: 'Vacant',
        tenantId: '',
        tenantEmail: '',
        activeTenantUids: [],
        tenantEmails: []
      });

      await Promise.all([...batchPromises, propUpdatePromise]);
      
      toast({ 
        title: 'Tenancy Ended', 
        description: 'All residents have been archived and the property is now marked as Vacant.' 
      });
      setIsEndTenancyDialogOpen(false);
    } catch (e) {
      console.error("End tenancy failed:", e);
      toast({ variant: 'destructive', title: 'Action Failed' });
    } finally {
      setIsEndingTenancy(false);
    }
  };

  const formatDateDivider = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, d MMMM');
  };

  if (isLoadingProperty) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!property) return <div className="text-center py-20 italic">Asset resolution failed.</div>;

  const propertyAddressTitle = [property.address.nameOrNumber, property.address.street].filter(Boolean).join(', ');
  const propertyAddressSubtitle = [property.address.city, property.address.postcode].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col gap-6 text-left max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
                <Button variant="outline" size="icon" asChild><Link href="/dashboard/properties"><ArrowLeft className="h-4 w-4" /></Link></Button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold font-headline leading-tight break-words">{propertyAddressTitle}</h1>
                    <p className="text-muted-foreground text-sm font-medium mt-1">{propertyAddressSubtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2 h-11 px-6 font-bold uppercase tracking-widest text-[10px] shadow-sm border-primary/20">
                            <MoreVertical className="h-4 w-4" />
                            <span>Manage Asset</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1">
                        <DropdownMenuItem asChild><Link href={`/dashboard/properties/${property.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Record</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => identityInputRef.current?.click()} disabled={isMediaUpdating}><Upload className="mr-2 h-4 w-4" /> Update Identity</DropdownMenuItem>
                        {property.status === 'Occupied' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setIsEndTenancyDialogOpen(true)} className="text-amber-600 font-bold">
                              <UserMinus className="mr-2 h-4 w-4" /> End Tenancy
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsDeleting(true)} className="text-destructive font-bold"><Trash2 className="mr-2 h-4 w-4" /> Archive Asset</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <input type="file" ref={identityInputRef} className="hidden" accept="image/*" onChange={(e) => handleMediaAction('upload', undefined, e.target.files)} />
            </div>
        </div>
        
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg border-none overflow-hidden text-left">
              <CardContent className="p-6">
                    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-md border-2 bg-muted mb-6 group">
                        {property.imageUrl ? (
                            <Image src={property.imageUrl} alt="Asset" fill className="object-cover" priority unoptimized />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/5"><Home className="h-16 w-16 text-primary/10" /></div>
                        )}
                        {isMediaUpdating && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
                    </div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Images className="h-3.5 w-3.5" />Photo Gallery</h3>
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary" onClick={() => galleryInputRef.current?.click()}>Add Photos</Button>
                        <input type="file" ref={galleryInputRef} className="hidden" multiple accept="image/*" onChange={(e) => handleMediaAction('upload', undefined, e.target.files)} />
                    </div>
                    <ScrollArea className="w-full">
                        <div className="flex w-max space-x-4 pb-4">
                            {property.additionalImageUrls?.map((url, idx) => (
                                <div key={idx} className="relative h-24 w-40 rounded-xl overflow-hidden border shadow-sm group bg-background">
                                    <Image src={url} alt="Gallery" fill className="object-cover" unoptimized />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                        <Button size="icon" variant="secondary" className="h-7 w-7 rounded-full" onClick={() => handleMediaAction('promote', url)}><CheckCircle2 className="h-4 w-4" /></Button>
                                        <Button size="icon" variant="destructive" className="h-7 w-7 rounded-full" onClick={() => handleMediaAction('delete', url)}><X className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
              </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-xl h-auto">
                    <TabsTrigger value="overview" className="px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px]">Overview</TabsTrigger>
                    <TabsTrigger value="messages" className="px-6 py-2 rounded-lg font-bold uppercase tracking-widest text-[10px] gap-2">
                        <MessageSquare className="h-3 w-3" /> Messages
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-6 pt-4">
                    {property.tenancy && (
                    <Card className="shadow-md border-none overflow-hidden">
                        <CardHeader className="pb-4 bg-muted/5 border-b"><CardTitle className="font-headline text-lg">Financial Audit</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-2xl bg-primary/5 shrink-0"><Banknote className="h-6 w-6 text-primary" /></div>
                                <div className="text-left"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Monthly Rent</p><p className="text-xl font-bold">£{property.tenancy.monthlyRent?.toLocaleString()}</p></div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-2xl bg-primary/5 shrink-0"><Shield className="h-6 w-6 text-primary" /></div>
                                <div className="text-left"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Deposit Amount</p><p className="text-xl font-bold">£{property.tenancy.depositAmount?.toLocaleString()}</p></div>
                            </div>
                        </CardContent>
                    </Card>
                    )}
                </TabsContent>
                <TabsContent value="messages" className="pt-4">
                    <Card className="shadow-lg border-none overflow-hidden flex flex-col h-[600px] bg-card">
                        <CardHeader className="bg-muted/10 border-b py-4 px-6 flex flex-row items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                                    <Inbox className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <CardTitle className="text-sm font-bold">Communication Ledger</CardTitle>
                                    {activeTenants && activeTenants.length > 1 ? (
                                        <div className="mt-1">
                                            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                                                <SelectTrigger className="h-7 text-[10px] font-bold uppercase tracking-widest bg-background border-primary/20 w-48">
                                                    <SelectValue placeholder="Switch Resident Thread" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {activeTenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <p className="text-[9px] text-green-600 font-bold uppercase tracking-widest">Encrypted audit active</p>
                                    )}
                                </div>
                            </div>
                            <Badge variant="outline" className="h-6 text-[8px] uppercase font-bold tracking-widest bg-background border-2 shadow-sm px-3">Live Sync</Badge>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden relative bg-muted/5">
                            <ScrollArea className="h-full">
                                <div className="p-6 space-y-6">
                                    <div ref={topRef} className="h-1" />
                                    {!messages?.length ? (
                                        <div className="py-20 text-center px-10 border-2 border-dashed rounded-[2rem] bg-muted/10 mx-4">
                                            <MessageSquare className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4" />
                                            <p className="text-sm font-bold text-foreground">Registry Trail Standby</p>
                                            <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto font-medium">Send your first message to start the chronological communication audit trail.</p>
                                        </div>
                                    ) : (
                                        messages.map((msg, idx) => {
                                            const isMe = msg.senderId === user?.uid;
                                            const date = safeToDate(msg.timestamp) || new Date();
                                            const prevMsg = messages[idx - 1];
                                            const showDateDivider = !prevMsg || !isSameDay(date, safeToDate(prevMsg.timestamp) || new Date());
                                            
                                            return (
                                                <div key={msg.id} className="space-y-4">
                                                    {showDateDivider && (
                                                        <div className="flex items-center gap-4 py-4">
                                                            <div className="h-px flex-1 bg-border" />
                                                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-background border px-3 py-1 rounded-full shadow-sm">{formatDateDivider(date)}</span>
                                                            <div className="h-px flex-1 bg-border" />
                                                        </div>
                                                    )}
                                                    <div className={cn("flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                                                        <div className="flex items-center gap-2 group/msg w-full">
                                                            <div className={cn(
                                                                "p-3.5 rounded-2xl text-sm font-medium shadow-sm leading-relaxed flex-1",
                                                                isMe ? "bg-primary text-primary-foreground rounded-tr-none order-1" : "bg-white text-foreground rounded-tl-none border border-muted order-2"
                                                            )}>
                                                                {msg.content}
                                                            </div>
                                                            {!isMe && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 opacity-0 group-hover/msg:opacity-100 transition-opacity order-3 text-muted-foreground hover:text-primary"
                                                                    title="Convert to Maintenance Request"
                                                                    asChild
                                                                >
                                                                    <Link href={`/dashboard/maintenance?propertyId=${property.id}&title=${encodeURIComponent(msg.content.substring(0, 50))}&description=${encodeURIComponent(msg.content)}`}>
                                                                        <Wrench className="h-4 w-4" />
                                                                    </Link>
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {format(date, 'HH:mm')}
                                                            {!isMe && <span className="ml-1 text-primary font-bold">Resident: {msg.senderName}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={scrollRef} className="h-4" />
                                </div>
                            </ScrollArea>
                        </CardContent>
                        <CardFooter className="p-4 border-t bg-background shrink-0">
                            <form onSubmit={handleSendReply} className="flex w-full gap-2">
                                <Input 
                                    placeholder={selectedTenantId ? `Message resident...` : "Select a resident to start..."} 
                                    value={newReply}
                                    onChange={(e) => setNewReply(e.target.value)}
                                    className="flex-1 rounded-xl h-11 bg-muted/20 border-2"
                                    disabled={isSendingReply || !selectedTenantId}
                                />
                                <Button type="submit" size="icon" className="h-11 w-11 rounded-xl shadow-lg shrink-0" disabled={!newReply.trim() || isSendingReply || !selectedTenantId}>
                                    {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </form>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
          </div>
          
          <div className="space-y-6">
            <Card className="shadow-md border-none overflow-hidden bg-muted/5 text-left">
              <CardHeader className="flex flex-row items-center justify-between pb-4 bg-muted/20 border-b">
                <CardTitle className="font-headline text-lg">Active Residents</CardTitle>
                <Button variant="ghost" size="icon" asChild className="text-primary"><Link href={`/dashboard/tenants/add?propertyId=${propertyId}`}><PlusCircle className="h-5 w-5" /></Link></Button>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                {!activeTenants?.length ? (
                  <div className="py-10 text-center border-2 border-dashed rounded-xl m-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">No residents assigned</p>
                  </div>
                ) : (
                  activeTenants.map((t) => (
                    <div 
                        key={t.id} 
                        className={cn(
                            "p-4 rounded-xl bg-background border shadow-sm flex items-center justify-between group transition-all cursor-pointer",
                            selectedTenantId === t.id ? "border-primary ring-1 ring-primary/20" : "hover:border-primary/20"
                        )}
                        onClick={() => { setSelectedTenantId(t.id); setActiveTab('messages'); }}
                    >
                        <div className="min-w-0 text-left">
                            <p className="font-bold truncate text-sm">{t.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-tight">{t.email}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                            <Link href={`/dashboard/tenants/${t.id}?propertyId=${propertyId}`} onClick={(e) => e.stopPropagation()}><ChevronRight className="h-4 w-4" /></Link>
                        </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            
            <Card className="shadow-md border-none overflow-hidden bg-muted/5">
              <CardHeader className="pb-4 bg-muted/20 border-b text-left"><CardTitle className="font-headline text-lg">Location Map</CardTitle></CardHeader>
              <CardContent className="p-0">
                  <div className="aspect-square w-full relative">
                      <iframe width="100%" height="100%" style={{ border: 0 }} title="Asset Map" loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent([property.address.street, property.address.city, property.address.postcode].filter(Boolean).join(', '))}&output=embed`}></iframe>
                  </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <AlertDialog open={isEndTenancyDialogOpen} onOpenChange={setIsEndTenancyDialogOpen}>
            <AlertDialogContent className="rounded-2xl border-none shadow-2xl text-left">
            <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="text-xl font-headline flex items-center gap-2">
                  <UserMinus className="h-6 w-6 text-amber-600" />
                  End Tenancy?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium">
                  This will archive all active residents for <strong>{property.address.street}</strong> and mark the property as Vacant. Access to the Resident Hub will be revoked for all tenants.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3 mt-4">
                <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-11">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-bold uppercase tracking-widest text-[10px] h-11 px-8 shadow-lg" onClick={handleEndTenancyConfirm} disabled={isEndingTenancy}>
                    {isEndingTenancy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm & Reset Asset
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
            <AlertDialogContent className="rounded-2xl border-none shadow-2xl text-left">
            <AlertDialogHeader className="text-left">
                <AlertDialogTitle className="text-xl font-headline">Archive Property Asset?</AlertDialogTitle>
                <AlertDialogDescription className="text-base font-medium">This will move the record at <strong className='text-foreground'>{property.address.street}</strong> to history archives.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3 mt-4">
                <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-11">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-[10px] h-11 px-8 shadow-lg" onClick={handleDeleteConfirm} disabled={isArchiving}>
                    {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Confirm Archive
                </AlertDialogAction>
            </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
