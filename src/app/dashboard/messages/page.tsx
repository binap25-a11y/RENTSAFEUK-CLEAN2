
'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Loader2, 
  User, 
  Search,
  ShieldCheck,
  Trash2,
  Reply,
  MoreVertical,
  CheckCircle2,
  Send,
  MapPin,
  Clock
} from 'lucide-react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, query, where, limit, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { safeToDate } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * @fileOverview Communication Hub
 * Optimized for reactive performance and non-blocking data mutations.
 * Implements standard cleanup for pointer-events to prevent UI freezes.
 */

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: any;
    tenantId: string;
    tenantUid?: string;
    tenantEmail?: string;
    propertyId: string;
    landlordId: string;
    read?: boolean;
}

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
}

export default function CommunicationHubPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Interaction States
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // 1. Fetch all messages for this landlord (Live Reactive Stream)
  const messagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'messages'),
        where('landlordId', '==', user.uid),
        limit(500)
    );
  }, [user?.uid, firestore]);

  const { data: rawMessages, isLoading: isLoadingMessages } = useCollection<Message>(messagesQuery);

  // 2. Resolve Asset Registry
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'properties'),
        where('landlordId', '==', user.uid)
    );
  }, [user?.uid, firestore]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const propertyMap = useMemo(() => {
    const map: Record<string, string> = {};
    properties?.forEach(p => {
        map[p.id] = [p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ');
    });
    return map;
  }, [properties]);

  // 3. Resolve Resident Registry
  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'tenants'),
        where('landlordId', '==', user.uid)
    );
  }, [user?.uid, firestore]);
  const { data: tenants } = useCollection<any>(tenantsQuery);

  const tenantNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    tenants?.forEach(t => {
        map[t.id] = t.name;
    });
    return map;
  }, [tenants]);

  // Chronological sorting in-memory for zero-freeze responsiveness
  const allMessages = useMemo(() => {
    if (!rawMessages) return [];
    return [...rawMessages].sort((a, b) => {
        const dateA = safeToDate(a.timestamp) || new Date(0);
        const dateB = safeToDate(b.timestamp) || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });
  }, [rawMessages]);

  const filteredMessages = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allMessages.filter(m => {
        const address = propertyMap[m.propertyId] || '';
        const residentName = tenantNameMap[m.tenantId] || m.senderName || '';
        return m.content.toLowerCase().includes(term) || 
               residentName.toLowerCase().includes(term) ||
               address.toLowerCase().includes(term);
    });
  }, [allMessages, searchTerm, propertyMap, tenantNameMap]);

  /**
   * DEFINITIVE CURSOR RECOVERY
   * Radix UI occasionally fails to restore pointer-events on the body if 
   * the component re-renders rapidly during a dialog close.
   */
  useEffect(() => {
    const cleanup = () => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
    };

    if (!messageToDelete && !replyingTo) {
      const timeout = setTimeout(cleanup, 150);
      return () => clearTimeout(timeout);
    }
  }, [messageToDelete, replyingTo]);

  const handleToggleRead = (msg: Message) => {
    if (!firestore) return;
    const msgRef = doc(firestore, 'messages', msg.id);
    updateDocumentNonBlocking(msgRef, { read: !msg.read });
    toast({ title: msg.read ? 'Marked as Unread' : 'Marked as Read' });
  };

  /**
   * OPTIMIZED NON-BLOCKING DELETE
   * Re-implemented with an aggressive deferral to prevent cursor freezes.
   */
  const handleDeleteConfirm = () => {
    if (!firestore || !messageToDelete) return;
    
    const docId = messageToDelete.id;
    const msgRef = doc(firestore, 'messages', docId);
    
    // 1. Instantly clear state to start modal close animation
    setMessageToDelete(null);
    
    // 2. Defer database call until animation is projected to finish
    // This allows the browser to prioritize Radix UI cleanup tasks.
    setTimeout(() => {
        deleteDocumentNonBlocking(msgRef);
        toast({ title: 'Record removed from registry' });
    }, 300); 
  };

  const handleSendReply = async () => {
    if (!firestore || !user || !replyingTo || !replyContent.trim()) return;
    
    setIsSendingReply(true);
    try {
        await addDoc(collection(firestore, 'messages'), {
            landlordId: user.uid,
            propertyId: replyingTo.propertyId,
            tenantId: replyingTo.tenantId,
            tenantUid: replyingTo.tenantUid || replyingTo.senderId,
            tenantEmail: replyingTo.tenantEmail || '',
            senderId: user.uid,
            senderName: user.displayName || 'Landlord',
            content: replyContent.trim(),
            timestamp: serverTimestamp(),
            read: false
        });

        if (!replyingTo.read) {
            const originalRef = doc(firestore, 'messages', replyingTo.id);
            updateDocumentNonBlocking(originalRef, { read: true });
        }

        toast({ title: 'Reply Sent' });
        setReplyContent('');
        setReplyingTo(null);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Transmission Error' });
    } finally {
        setIsSendingReply(false);
    }
  };

  const handleSearchChange = (val: string) => {
    startTransition(() => {
        setSearchTerm(val);
    });
  };

  const navigateToThread = (propertyId: string, tenantId: string) => {
    router.push(`/dashboard/properties/${propertyId}?tab=messages&tenantId=${tenantId}`);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                <MessageSquare className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Communication Hub</h1>
        </div>
        <p className="text-muted-foreground font-medium text-lg ml-1">Live management hub for all resident and asset interactions.</p>
      </div>

      <div className="flex items-center justify-between gap-4 px-1">
          <div className="relative w-full max-w-md">
              <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all",
                  isPending && "animate-pulse text-primary"
              )} />
              <Input 
                placeholder="Search conversations..." 
                className="pl-10 h-12 bg-card border-muted rounded-2xl shadow-sm focus-visible:ring-primary" 
                onChange={e => handleSearchChange(e.target.value)} 
              />
          </div>
          <div>
              <Badge variant="outline" className="h-12 px-4 rounded-2xl border-2 font-bold uppercase tracking-widest text-[10px] bg-background shadow-sm">
                  <span className="text-primary mr-1">{filteredMessages.length}</span> messages
              </Badge>
          </div>
      </div>

      {isLoadingMessages ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse text-center">Syncing Hub...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="text-center py-32 border-2 border-dashed rounded-[3rem] bg-muted/5">
            <div className="p-6 rounded-full bg-background shadow-xl w-fit mx-auto mb-6">
                <MessageSquare className="h-12 w-12 text-primary/10" />
            </div>
            <h3 className="text-xl font-bold">Inbox Empty</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">No communication records found matching your search criteria.</p>
        </div>
      ) : (
        <div className="grid gap-4">
            {filteredMessages.map((msg) => {
                const isLandlord = msg.senderId === user?.uid;
                const isUnread = !isLandlord && msg.read !== true;
                const propertyAddress = propertyMap[msg.propertyId] || 'Assigned Asset';
                const residentName = tenantNameMap[msg.tenantId] || msg.senderName || 'Resident';
                
                return (
                    <Card 
                        key={msg.id} 
                        className={cn(
                            "shadow-md border-none overflow-hidden transition-all group relative cursor-pointer",
                            isUnread ? "ring-2 ring-primary/20 bg-primary/[0.02]" : "hover:bg-muted/5"
                        )}
                        onClick={() => navigateToThread(msg.propertyId, msg.tenantId)}
                    >
                        <div className="flex items-start gap-4 p-5">
                            <div className="relative shrink-0">
                                <div className={cn(
                                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                                    isLandlord ? "bg-muted text-muted-foreground" : (isUnread ? "bg-primary text-primary-foreground" : "bg-primary/5 text-primary")
                                )}>
                                    <User className="h-6 w-6" />
                                </div>
                                {isUnread && (
                                    <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive rounded-full border-2 border-background animate-pulse shadow-sm" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex flex-col text-left">
                                        <div className="flex items-center gap-2">
                                            <p className={cn("font-bold text-base truncate", isUnread && "text-primary")}>
                                                {isLandlord ? `To: ${residentName}` : residentName}
                                            </p>
                                            {isLandlord && <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-tighter h-4 py-0">Reply Sent</Badge>}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight truncate max-w-[250px]">
                                                {propertyAddress}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 self-start">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap pt-1">
                                            {safeToDate(msg.timestamp) ? format(safeToDate(msg.timestamp)!, 'HH:mm • d MMM') : 'Just now'}
                                        </span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 p-1">
                                                <DropdownMenuItem 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReplyingTo(msg);
                                                    }} 
                                                    className="cursor-pointer"
                                                >
                                                    <Reply className="mr-2 h-4 w-4" /> Send Reply
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleRead(msg);
                                                    }} 
                                                    className="cursor-pointer"
                                                >
                                                    <CheckCircle2 className="mr-2 h-4 w-4" /> 
                                                    {msg.read ? 'Mark as Unread' : 'Mark as Read'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigateToThread(msg.propertyId, msg.tenantId);
                                                    }} 
                                                    className="cursor-pointer"
                                                >
                                                    <MessageSquare className="mr-2 h-4 w-4" /> View Full Thread
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMessageToDelete(msg);
                                                    }} 
                                                    className="text-destructive font-bold cursor-pointer"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <div className="bg-muted/30 p-3 rounded-xl border border-muted mb-3 group-hover:bg-muted/40 transition-colors">
                                    <p className={cn("text-sm leading-relaxed", isUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                                        "{msg.content}"
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {!isLandlord && (
                                        <Button 
                                            variant="link" 
                                            className="h-auto p-0 text-[10px] font-bold uppercase tracking-widest text-primary gap-1" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setReplyingTo(msg);
                                            }}
                                        >
                                            <Reply className="h-3 w-3" /> Quick Reply
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
      )}
      
      <div className="p-6 rounded-2xl bg-muted/30 border border-dashed flex items-center gap-4 text-left">
          <ShieldCheck className="h-10 w-10 text-primary opacity-20 shrink-0" />
          <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Professional Communication Audit</p>
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed font-medium">All interactions are chronologically recorded. The registry is fully reactive and restores pointer interactivity instantly after each data mutation.</p>
          </div>
      </div>

      {/* Reply Dialog */}
      <Dialog open={!!replyingTo} onOpenChange={(open) => !open && setReplyingTo(null)}>
        <DialogContent className="max-w-lg text-left overflow-hidden rounded-2xl border-none shadow-2xl">
            <DialogHeader className="bg-primary/5 -mx-6 -mt-6 p-6 border-b border-primary/10 text-left">
                <DialogTitle className="flex items-center gap-2">
                    <Reply className="h-5 w-5 text-primary" />
                    Professional Response
                </DialogTitle>
                <DialogDescription className="font-medium text-primary/60">
                    Responding to {tenantNameMap[replyingTo?.tenantId || ''] || replyingTo?.senderName}
                </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-6">
                <div className="bg-muted/30 p-4 rounded-xl border-2 border-dashed italic text-sm text-muted-foreground">
                    "{replyingTo?.content}"
                </div>
                <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground px-1">Reply Content</p>
                    <Textarea 
                        placeholder="Type your response to the resident..." 
                        rows={5}
                        className="resize-none rounded-xl border-2 focus-visible:ring-primary h-32"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                    />
                </div>
            </div>
            <DialogFooter className="bg-muted/5 -mx-6 -mb-6 p-6 border-t flex items-center justify-between">
                <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                    <Clock className="h-3 w-3" />
                    Encrypted Channel
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="ghost" onClick={() => setReplyingTo(null)} className="font-bold">Cancel</Button>
                    <Button onClick={handleSendReply} disabled={!replyContent.trim() || isSendingReply} className="px-8 shadow-lg font-bold">
                        {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                        Send Reply
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl text-left">
            <AlertDialogHeader className="text-left">
                <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4">
                    <Trash2 className="h-8 w-8 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl font-headline text-center">Remove Audit Record?</AlertDialogTitle>
                <AlertDialogDescription className="text-center font-medium">
                    This will permanently remove this record from the registry history. Your mouse cursor will remain active for subsequent tasks.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3 flex-col-reverse sm:flex-row">
                <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px] h-12 flex-1 border-2">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-[10px] h-12 flex-1 shadow-lg">
                    Confirm Deletion
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
