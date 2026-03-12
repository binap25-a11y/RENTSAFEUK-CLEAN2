
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  Loader2, 
  User,
  ShieldCheck,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit, addDoc, collection, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: any;
}

export default function TenantMessagesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || !firestore || !user.email) {
      setIsLoadingContext(false);
      return;
    }
    
    const userEmail = user.email.toLowerCase().trim();

    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', userEmail),
        limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
        const activeTenant = snap.docs.find(d => d.data().status === 'Active');
        if (activeTenant) {
            const data = activeTenant.data();
            setTenantContext({ 
                landlordId: data.landlordId, 
                propertyId: data.propertyId, 
                tenantId: activeTenant.id 
            });
        }
        setIsLoadingContext(false);
    }, (error) => {
        console.warn("Messenger discovery issue:", error.message);
        setIsLoadingContext(false);
    });
    return () => unsub();
  }, [user, isUserLoading, firestore]);

  const messagesQuery = useMemoFirebase(() => {
    if (!tenantContext || !user || !firestore) return null;
    return query(
        collection(firestore, 'messages'),
        where('tenantId', '==', tenantContext.tenantId),
        orderBy('timestamp', 'asc'),
        limit(100)
    );
  }, [tenantContext, user, firestore]);

  const { data: messages, isLoading: isLoadingMessages } = useCollection<Message>(messagesQuery);

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
            senderId: user.uid,
            senderName: user.displayName || 'Tenant',
            content: newMessage.trim(),
            timestamp: serverTimestamp()
        });
        setNewMessage('');
    } catch (error) {
        console.error(error);
    } finally {
        setIsSending(false);
    }
  };

  if (isLoadingContext || isUserLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Secure Portal...</p>
      </div>
    );
  }

  if (!tenantContext) {
    return (
      <Card className="max-w-md mx-auto mt-10 shadow-lg border-none text-center">
        <CardHeader className="bg-muted/20 pb-8">
          <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 border shadow-sm">
              <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-lg">Portal Access Limited</CardTitle>
          <CardDescription>We could not verify your identity association.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full font-bold h-11" asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-bold font-headline text-primary">Direct Messaging</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest flex items-center gap-1.5 mt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                Secure Encrypted Channel
            </p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden shadow-2xl border-none flex flex-col bg-card">
        <CardHeader className="border-b bg-muted/10 py-4">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <User className="h-5 w-5" />
                </div>
                <div>
                    <CardTitle className="text-sm font-bold">Property Landlord</CardTitle>
                    <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">Active Connection</p>
                </div>
            </div>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden relative">
            <ScrollArea className="h-full p-6">
                <div className="space-y-6">
                    {isLoadingMessages ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
                    ) : !messages?.length ? (
                        <div className="py-20 text-center px-10">
                            <MessageSquare className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground italic">No messages yet.</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMe = msg.senderId === user?.uid;
                            const date = msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000) : new Date();
                            
                            return (
                                <div key={msg.id} className={cn("flex flex-col gap-1 max-w-[80%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                                    <div className={cn(
                                        "p-4 rounded-2xl text-sm font-medium shadow-sm",
                                        isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none"
                                    )}>
                                        {msg.content}
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground px-1">{format(date, 'HH:mm')}</span>
                                </div>
                            );
                        })
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>
        </CardContent>
        <CardFooter className="border-t p-4 bg-muted/5">
            <form onSubmit={handleSendMessage} className="flex w-full gap-2">
                <Input 
                    placeholder="Type your message..." 
                    className="h-12 rounded-xl bg-background border-2 shadow-none focus-visible:ring-primary"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isSending}
                />
                <Button type="submit" size="icon" className="h-12 w-12 rounded-xl shrink-0 shadow-lg" disabled={!newMessage.trim() || isSending}>
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
            </form>
        </CardFooter>
      </Card>
    </div>
  );
}
