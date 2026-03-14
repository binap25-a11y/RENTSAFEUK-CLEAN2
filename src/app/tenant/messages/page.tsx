
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardFooter, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Building2,
  History,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { query, where, limit, addDoc, collection, onSnapshot, orderBy, serverTimestamp, doc } from 'firebase/firestore';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: any;
    tenantId: string;
    propertyId: string;
    landlordId: string;
    read?: boolean;
}

export default function TenantMessagesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Discovery: Map Auth Email to Registry Record
  useEffect(() => {
    if (isUserLoading || !user || !firestore || !user.email) {
      if (!user && !isUserLoading) setIsLoadingContext(false);
      return;
    }
    
    const userEmail = user.email.toLowerCase().trim();
    const tenantsCol = collection(firestore, 'tenants');
    const q = query(tenantsCol, where('email', '==', userEmail), limit(1));

    const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
            const data = snap.docs[0].data();
            setTenantContext({ 
                landlordId: data.landlordId, 
                propertyId: data.propertyId, 
                tenantId: snap.docs[0].id,
                email: data.email
            });
        }
        setIsLoadingContext(false);
    }, (error) => {
        console.warn("Messaging handshake sync issue:", error.message);
        setIsLoadingContext(false);
    });
    return () => unsub();
  }, [user, isUserLoading, firestore]);

  // Real-time chronological message ledger keyed by stable tenant doc ID
  const messagesQuery = useMemoFirebase(() => {
    if (!tenantContext || !user || !firestore || !user.email) return null;
    const userEmail = user.email.toLowerCase().trim();
    return query(
        collection(firestore, 'messages'),
        where('propertyId', '==', tenantContext.propertyId),
        where('tenantId', '==', tenantContext.tenantId),
        where('tenantEmail', '==', userEmail),
        orderBy('timestamp', 'asc'),
        limit(100)
    );
  }, [tenantContext, user, firestore]);

  const { data: messages, isLoading: isLoadingMessages, error: messagesError } = useCollection<Message>(messagesQuery);

  // Mark messages as read when viewing the thread
  useEffect(() => {
    if (messages && user) {
      const unreadIncoming = messages.filter(m => m.senderId !== user.uid && m.read !== true);
      if (unreadIncoming.length > 0) {
        unreadIncoming.forEach(msg => {
          const msgRef = doc(firestore, 'messages', msg.id);
          updateDocumentNonBlocking(msgRef, { read: true });
        });
      }
    }
  }, [messages, user, firestore]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !tenantContext || !user || isSending) return;

    setIsSending(true);
    try {
        const msgCol = collection(firestore, 'messages');
        await addDoc(msgCol, {
            landlordId: tenantContext.landlordId,
            propertyId: tenantContext.propertyId,
            tenantId: tenantContext.tenantId, 
            tenantUid: user.uid, 
            tenantEmail: tenantContext.email || user.email?.toLowerCase().trim(),
            senderId: user.uid,
            senderName: user.displayName || 'Resident',
            content: newMessage.trim(),
            timestamp: serverTimestamp(),
            read: false
        });
        setNewMessage('');
        toast({ title: 'Message Sent' });
    } catch (error) {
        console.error("Transmission failure:", error);
        toast({ variant: 'destructive', title: 'Transmission Failed' });
    } finally {
        setIsSending(false);
    }
  };

  const scrollToTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });
  const scrollToBottom = () => scrollRef.current?.scrollIntoView({ behavior: 'smooth' });

  const getMessageDate = (timestamp: any) => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return new Date(timestamp);
  };

  const formatDateDivider = (date: Date) => {
    try {
        if (isToday(date)) return 'Today';
        if (isYesterday(date)) return 'Yesterday';
        return format(date, 'EEEE, d MMMM yyyy');
    } catch (e) { return 'Audit History'; }
  };

  if (isLoadingContext || isUserLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="bg-primary/5 p-10 rounded-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Portal Ledger...</p>
      </div>
    );
  }

  if (!tenantContext) {
    return (
      <Card className="max-w-md mx-auto mt-10 shadow-2xl border-none text-center overflow-hidden">
        <CardHeader className="bg-muted/20 pb-8 border-b">
          <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 border shadow-sm">
              <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-primary font-headline">Sync Required</CardTitle>
          <CardDescription className='font-medium text-muted-foreground'>A verified tenancy registry link is required to access the secure audit channel.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <Button variant="outline" className="w-full h-12 font-bold uppercase tracking-widest text-[10px]" asChild>
              <Link href="/tenant/dashboard">Return to Hub</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col gap-4 text-left max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between shrink-0">
          <div className="flex flex-col gap-1 text-left">
              <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Resident Communication</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.3em] flex items-center gap-1.5 px-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                  Audit Trail Verified
              </p>
          </div>
          <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={scrollToTop} className="font-bold uppercase tracking-widest text-[9px] h-9 px-4 border-primary/20 bg-background shadow-sm">
                  <History className="h-3.5 w-3.5 mr-1.5" /> Full History
              </Button>
              <Button variant="outline" size="sm" onClick={scrollToBottom} className="font-bold uppercase tracking-widest text-[9px] h-9 px-4 border-primary/20 bg-background shadow-sm md:hidden">
                  <ChevronDown className="h-3.5 w-3.5" />
              </Button>
          </div>
      </div>

      <Card className="flex-1 overflow-hidden shadow-2xl border-none flex flex-col bg-card">
        <CardHeader className="border-b bg-muted/10 py-4 px-6 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                    <Building2 className="h-5 w-5" />
                </div>
                <div className="text-left">
                    <CardTitle className="text-sm font-bold">Management Support</CardTitle>
                    <p className="text-[9px] text-green-600 font-bold uppercase tracking-widest flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Encrypted Registry Link
                    </p>
                </div>
            </div>
            {messagesError ? (
                <Badge variant="destructive" className="h-6 text-[8px] uppercase font-bold tracking-widest px-3 gap-1">
                    <AlertCircle className="h-2.5 w-2.5" /> Sync Error
                </Badge>
            ) : (
                <Badge variant="outline" className="h-6 text-[8px] uppercase font-bold tracking-widest bg-background border-2 shadow-sm px-3">Private audit</Badge>
            )}
        </CardHeader>
        
        <CardContent className="flex-1 p-0 overflow-hidden relative bg-muted/5">
            <ScrollArea className="h-full">
                <div className="p-6">
                    <div ref={topRef} className="h-1" />
                    <div className="space-y-6 text-left">
                        {isLoadingMessages ? (
                            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary/20" /></div>
                        ) : messagesError ? (
                            <div className="py-24 text-center px-10 border-2 border-dashed border-destructive/20 rounded-[2rem] bg-destructive/5 mx-4">
                                <AlertCircle className="h-12 w-12 text-destructive/20 mx-auto mb-4" />
                                <p className="text-sm font-bold text-destructive">Registry Standby</p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-[320px] mx-auto font-medium">The chronological communication audit is temporarily establishing high-performance indexes. Please wait 2 minutes.</p>
                                <Button variant="outline" className="mt-6 h-9" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-3 w-3" /> Retry Sync</Button>
                            </div>
                        ) : !messages?.length ? (
                            <div className="py-24 text-center px-10 border-2 border-dashed rounded-[2rem] bg-muted/10 mx-4">
                                <MessageSquare className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4" />
                                <p className="text-sm font-bold text-foreground">Registry Handshake Established</p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto font-medium">Your chat history is private and chronologically recorded for professional property management.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isMe = msg.senderId === user?.uid;
                                const date = getMessageDate(msg.timestamp);
                                
                                const prevMsg = messages[idx - 1];
                                const showDateDivider = !prevMsg || !isSameDay(date, getMessageDate(prevMsg.timestamp));
                                
                                return (
                                    <div key={msg.id} className="space-y-4 text-left">
                                        {showDateDivider && (
                                            <div className="flex items-center gap-4 py-4 text-left">
                                                <div className="h-px flex-1 bg-border" />
                                                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-background border px-4 py-1.5 rounded-full shadow-sm">
                                                    <Calendar className="h-3 w-3 inline-block mr-1.5 opacity-50" />
                                                    {formatDateDivider(date)}
                                                </span>
                                                <div className="h-px flex-1 bg-border" />
                                            </div>
                                        )}
                                        <div className={cn("flex flex-col gap-1.5 max-w-[85%] sm:max-w-[70%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                                            <div className={cn(
                                                "p-4 rounded-2xl text-sm font-medium shadow-md leading-relaxed",
                                                isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white text-foreground rounded-tl-none border-2 border-muted"
                                            )}>
                                                {msg.content}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
                                                <Clock className="h-2.5 w-2.5" />
                                                {format(date, 'HH:mm')}
                                                {!isMe && <span className="ml-1 opacity-60 font-bold text-primary">From: Management</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={scrollRef} className="h-4" />
                    </div>
                </div>
            </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 border-t bg-background shadow-inner shrink-0">
            <form onSubmit={handleSendMessage} className="flex w-full items-center gap-3">
                <Input 
                    placeholder="Type a verified message to management..." 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 h-12 bg-muted/20 border-2 focus-visible:ring-primary rounded-2xl font-medium shadow-none transition-all focus:bg-background"
                    disabled={isSending || isLoadingMessages}
                />
                <Button type="submit" size="icon" className="h-12 w-12 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 shrink-0" disabled={!newMessage.trim() || isSending || isLoadingMessages}>
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
            </form>
        </CardFooter>
      </Card>
    </div>
  );
}
