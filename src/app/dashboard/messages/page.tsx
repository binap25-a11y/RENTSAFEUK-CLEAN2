
'use client';

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
  MapPin,
  Clock,
  Wrench,
  AlertTriangle,
  ChevronRight,
  Inbox,
  Send
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

interface Conversation {
    id: string;
    propertyId: string;
    tenantId: string;
    lastMessage: Message;
    unreadCount: number;
    totalCount: number;
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

const QUICK_REPLIES = [
  "I've received your message and will look into this shortly.",
  "Thank you for letting me know. I've assigned a contractor to visit.",
  "Rent payment received, thank you.",
  "Please see the shared documents vault for the requested files."
];

const URGENCY_KEYWORDS = ['leak', 'emergency', 'urgent', 'broken', 'repair', 'flood', 'fire', 'danger'];

export default function CommunicationHubPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());

  // INTERACTION RECOVERY: Force clear pointer locks if browser gets stuck after modal close
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

  const messagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'messages'),
        where('landlordId', '==', user.uid),
        limit(500)
    );
  }, [user?.uid, firestore]);

  const { data: rawMessages, isLoading: isLoadingMessages } = useCollection<Message>(messagesQuery);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid));
  }, [user?.uid, firestore]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const propertyMap = useMemo(() => {
    const map: Record<string, string> = {};
    properties?.forEach(p => {
        map[p.id] = [p.address.nameOrNumber, p.address.street].filter(Boolean).join(', ');
    });
    return map;
  }, [properties]);

  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'tenants'), where('landlordId', '==', user.uid));
  }, [user?.uid, firestore]);
  const { data: tenants } = useCollection<any>(tenantsQuery);

  const tenantNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    tenants?.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [tenants]);

  const conversations = useMemo((): Conversation[] => {
    if (!rawMessages || !user) return [];
    
    const term = searchTerm.toLowerCase();
    const threads: Record<string, Conversation> = {};
    
    rawMessages.forEach(m => {
        if (optimisticDeletedIds.has(m.id)) return;
        
        const threadId = `${m.propertyId}_${m.tenantId}`;
        const isIncoming = m.senderId !== user.uid;
        const isUnread = isIncoming && m.read !== true;

        if (!threads[threadId] || (safeToDate(m.timestamp)?.getTime() || 0) > (safeToDate(threads[threadId].lastMessage.timestamp)?.getTime() || 0)) {
            threads[threadId] = {
                id: threadId,
                propertyId: m.propertyId,
                tenantId: m.tenantId,
                lastMessage: m,
                unreadCount: (threads[threadId]?.unreadCount || 0) + (isUnread ? 1 : 0),
                totalCount: (threads[threadId]?.totalCount || 0) + 1
            };
        } else {
            if (isUnread) threads[threadId].unreadCount += 1;
            threads[threadId].totalCount += 1;
        }
    });

    return Object.values(threads)
        .filter(c => {
            const address = propertyMap[c.propertyId] || '';
            const residentName = tenantNameMap[c.tenantId] || c.lastMessage.senderName || '';
            return residentName.toLowerCase().includes(term) || address.toLowerCase().includes(term);
        })
        .sort((a, b) => {
            const dateA = safeToDate(a.lastMessage.timestamp) || new Date(0);
            const dateB = safeToDate(b.lastMessage.timestamp) || new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
  }, [rawMessages, searchTerm, propertyMap, tenantNameMap, optimisticDeletedIds, user]);

  const handleDeleteConfirm = () => {
    if (!firestore || !messageToDelete) return;
    const id = messageToDelete.id;
    // OPTIMISTIC DELETION: Remove from local set instantly
    setOptimisticDeletedIds(prev => new Set(prev).add(id));
    setMessageToDelete(null);
    
    // Non-blocking background sync
    deleteDocumentNonBlocking(doc(firestore, 'messages', id));
    toast({ title: 'Record removed' });
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
            senderName: user.displayName || 'Management',
            content: replyContent.trim(),
            timestamp: serverTimestamp(),
            read: false
        });
        if (!replyingTo.read) {
            updateDocumentNonBlocking(doc(firestore, 'messages', replyingTo.id), { read: true });
        }
        toast({ title: 'Reply Sent' });
        setReplyContent('');
        setReplyingTo(null);
    } catch (err) {
        toast({ variant: 'destructive', title: 'Error' });
    } finally {
        setIsSendingReply(false);
    }
  };

  const navigateToThread = (propertyId: string, tenantId: string) => {
    router.push(`/dashboard/properties/${propertyId}?tab=messages&tenantId=${tenantId}`);
  };

  const isUrgent = (content: string) => {
    const lower = content.toLowerCase();
    return URGENCY_KEYWORDS.some(kw => lower.includes(kw));
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                <Inbox className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Communication Hub</h1>
        </div>
        <p className="text-muted-foreground font-medium text-lg ml-1">Grouped conversation registry for verified residents.</p>
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
                onChange={e => startTransition(() => setSearchTerm(e.target.value))} 
              />
          </div>
          <Badge variant="outline" className="h-12 px-4 rounded-2xl border-2 font-bold uppercase tracking-widest text-[10px] bg-background shadow-sm">
              <span className="text-primary mr-1">{conversations.length}</span> messages
          </Badge>
      </div>

      {isLoadingMessages ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Registry...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-32 border-2 border-dashed rounded-[3rem] bg-muted/5">
            <MessageSquare className="h-12 w-12 text-primary/10 mx-auto mb-4" />
            <h3 className="text-xl font-bold">Inbox Clear</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">No communication threads found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid gap-4">
            {conversations.map((conv) => {
                const msg = conv.lastMessage;
                const residentName = tenantNameMap[conv.tenantId] || msg.senderName || 'Resident';
                const propertyAddress = propertyMap[conv.propertyId] || 'Assigned Asset';
                const isLandlordLast = msg.senderId === user?.uid;
                const hasUnread = conv.unreadCount > 0;
                const urgent = isUrgent(msg.content);
                
                return (
                    <Card 
                        key={conv.id} 
                        className={cn(
                            "shadow-md border-none overflow-hidden transition-all group relative cursor-pointer hover:shadow-xl",
                            hasUnread ? "ring-2 ring-primary/20 bg-primary/[0.02]" : "hover:bg-muted/5",
                            urgent && "border-l-4 border-l-destructive"
                        )}
                        onClick={() => navigateToThread(conv.propertyId, conv.tenantId)}
                    >
                        <div className="flex items-start gap-4 p-5">
                            <div className="relative shrink-0 pt-1">
                                <div className={cn(
                                    "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm",
                                    hasUnread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}>
                                    <User className="h-6 w-6" />
                                </div>
                                {hasUnread && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-destructive text-[10px] font-bold text-white rounded-full border-2 border-background shadow-lg">
                                        {conv.unreadCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex flex-col text-left">
                                        <div className="flex items-center gap-2">
                                            <p className={cn("font-bold text-base truncate", hasUnread && "text-primary")}>
                                                {residentName}
                                            </p>
                                            {urgent && (
                                                <Badge variant="destructive" className="h-4 px-1.5 text-[8px] font-bold uppercase tracking-widest animate-pulse">
                                                    Urgent
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight truncate max-w-[250px]">
                                                {propertyAddress}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-start pt-1">
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-primary" 
                                                title="Reply"
                                                onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }}
                                            >
                                                <Reply className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground" 
                                                title="Log as Maintenance"
                                                asChild
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Link href={`/dashboard/maintenance?propertyId=${msg.propertyId}&title=${encodeURIComponent(msg.content.substring(0, 50))}&description=${encodeURIComponent(msg.content)}`}>
                                                    <Wrench className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-destructive" 
                                                title="Delete Record"
                                                onClick={(e) => { e.stopPropagation(); setMessageToDelete(msg); }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
                                            {safeToDate(msg.timestamp) ? format(safeToDate(msg.timestamp)!, 'd MMM HH:mm') : 'Just now'}
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                                <div className="bg-muted/30 p-3 rounded-xl border border-muted group-hover:bg-muted/40 transition-colors">
                                    <p className={cn("text-sm line-clamp-2", hasUnread ? "text-foreground font-semibold" : "text-muted-foreground")}>
                                        {isLandlordLast && <span className="text-primary mr-1 font-bold">You:</span>}
                                        "{msg.content}"
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
      )}

      <Dialog open={!!replyingTo} onOpenChange={(open) => !open && setReplyingTo(null)}>
        <DialogContent className="max-w-lg text-left rounded-2xl border-none shadow-2xl">
            <DialogHeader className="bg-primary/5 -mx-6 -mt-6 p-6 border-b border-primary/10">
                <DialogTitle className="flex items-center gap-2">
                    <Reply className="h-5 w-5 text-primary" />
                    Quick Response
                </DialogTitle>
                <DialogDescription>Sending reply to thread.</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-6">
                <div className="bg-muted/20 p-4 rounded-xl border border-dashed mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Original Message</p>
                    <p className="text-xs italic text-muted-foreground line-clamp-3">"{replyingTo?.content}"</p>
                </div>
                <Textarea 
                    placeholder="Type your response..." 
                    rows={5}
                    className="resize-none rounded-xl border-2 h-32"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                    {QUICK_REPLIES.map((reply, idx) => (
                        <Button 
                            key={idx} 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[9px] font-bold uppercase rounded-lg border-primary/20 hover:bg-primary/5"
                            onClick={() => setReplyContent(reply)}
                        >
                            {reply.split(' ').slice(0, 3).join(' ')}...
                        </Button>
                    ))}
                </div>
            </div>
            <DialogFooter className="gap-3">
                <Button variant="ghost" className="font-bold uppercase tracking-widest text-[10px]" onClick={() => setReplyingTo(null)}>Cancel</Button>
                <Button onClick={handleSendReply} disabled={!replyContent.trim() || isSendingReply} className="px-8 shadow-lg font-bold uppercase tracking-widest text-[10px]">
                    {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Reply
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl text-left">
            <AlertDialogHeader className="text-left">
                <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-4">
                    <Trash2 className="h-8 w-8 text-destructive" />
                </div>
                <AlertDialogTitle className="text-xl font-headline text-center">Remove Audit Record?</AlertDialogTitle>
                <AlertDialogDescription className="text-center">This will permanently remove this message from the chronological registry. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3">
                <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] h-12 flex-1 border-2">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white rounded-xl font-bold uppercase text-[10px] h-12 flex-1 shadow-lg">
                    Confirm Deletion
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
