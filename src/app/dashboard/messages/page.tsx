'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Loader2, 
  ChevronRight, 
  Home, 
  User, 
  Search,
  ShieldCheck,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { safeToDate } from '@/lib/date-utils';

/**
 * @fileOverview Communication Registry
 * Central audit page for all landlord-tenant communication.
 * Groups individual messages into threads for a cleaner professional overview.
 */

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

interface Thread {
    id: string;
    tenantId: string;
    propertyId: string;
    lastMessage: Message;
    unreadCount: number;
}

export default function LandlordInboxPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all messages for this landlord
  // NOTE: Removed orderBy('timestamp') from Firestore query to prevent exclusion of docs missing the field.
  // We handle sorting in-memory for maximum visibility of legacy/orphaned data.
  const messagesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'messages'),
        where('landlordId', '==', user.uid),
        limit(500)
    );
  }, [user, firestore]);

  const { data: rawMessages, isLoading, error } = useCollection<Message>(messagesQuery);

  // Group messages into threads and calculate unread status
  const threads = useMemo(() => {
    if (!rawMessages) return [];
    
    // Sort in memory so that documents missing timestamps are still processed
    const allMessages = [...rawMessages].sort((a, b) => {
        const dateA = safeToDate(a.timestamp) || new Date(0);
        const dateB = safeToDate(b.timestamp) || new Date(0);
        return dateB.getTime() - dateA.getTime();
    });

    const threadMap = new Map<string, Thread>();
    
    allMessages.forEach(msg => {
        // Robust Key: Prioritize property link, then tenant identity, then sender identity
        const identityKey = msg.tenantId || msg.senderId;
        const threadKey = msg.propertyId ? `${msg.propertyId}-${identityKey}` : `direct-${identityKey}`;
            
        const isIncomingUnread = msg.senderId !== user?.uid && msg.read !== true;

        if (!threadMap.has(threadKey)) {
            threadMap.set(threadKey, {
                id: threadKey,
                tenantId: msg.tenantId || '',
                propertyId: msg.propertyId || '',
                lastMessage: msg,
                unreadCount: isIncomingUnread ? 1 : 0
            });
        } else {
            const thread = threadMap.get(threadKey)!;
            // Since messages are sorted newest first, the first one encountered is the 'lastMessage'
            if (isIncomingUnread) {
                thread.unreadCount += 1;
            }
        }
    });
    
    return Array.from(threadMap.values());
  }, [rawMessages, user]);

  const filteredThreads = useMemo(() => {
    if (!searchTerm) return threads;
    const term = searchTerm.toLowerCase();
    return threads.filter(t => 
        t.lastMessage.content.toLowerCase().includes(term) || 
        t.lastMessage.senderName.toLowerCase().includes(term)
    );
  }, [threads, searchTerm]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                <MessageSquare className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Communication Registry</h1>
        </div>
        <p className="text-muted-foreground font-medium text-lg ml-1">Central audit of all resident conversations across your portfolio.</p>
      </div>

      <div className="flex items-center justify-between gap-4 px-1">
          <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or message content..." 
                className="pl-10 h-12 bg-card border-muted rounded-2xl shadow-sm focus-visible:ring-primary" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
          </div>
          <div className="hidden sm:block">
              <Badge variant="outline" className="h-12 px-4 rounded-2xl border-2 font-bold uppercase tracking-widest text-[10px] bg-background">
                  {rawMessages?.length || 0} Total Messages
              </Badge>
          </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Synchronizing Inbox Registry...</p>
        </div>
      ) : error ? (
        <div className="py-20 text-center px-10 border-2 border-dashed border-destructive/20 rounded-[2rem] bg-destructive/5">
            <AlertCircle className="h-12 w-12 text-destructive/20 mx-auto mb-4" />
            <p className="text-sm font-bold text-destructive">Sync Standby</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[320px] mx-auto font-medium">
                Indexes are being established or you may have a permission issue. 
            </p>
            <Button variant="outline" className="mt-6 h-9" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry Sync
            </Button>
        </div>
      ) : filteredThreads.length === 0 ? (
        <div className="text-center py-32 border-2 border-dashed rounded-[3rem] bg-muted/5">
            <div className="p-6 rounded-full bg-background shadow-xl w-fit mx-auto mb-6">
                <MessageSquare className="h-12 w-12 text-primary/10" />
            </div>
            <h3 className="text-xl font-bold">No Conversations Found</h3>
            <p className="text-muted-foreground mt-2 max-w-xs mx-auto">Active communication with your residents will appear here once established in the Property Hub.</p>
        </div>
      ) : (
        <div className="grid gap-4">
            {filteredThreads.map((thread) => (
                <Link key={thread.id} href={thread.propertyId ? `/dashboard/properties/${thread.propertyId}?tab=messages` : '#'}>
                    <Card className="shadow-md border-none overflow-hidden transition-all hover:shadow-xl hover:translate-x-1 group">
                        <div className="flex items-center gap-4 p-5">
                            <div className="relative">
                                <div className="h-12 w-12 rounded-2xl bg-primary/5 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shadow-sm">
                                    <User className="h-6 w-6" />
                                </div>
                                {thread.unreadCount > 0 && (
                                    <Badge className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 bg-destructive text-destructive-foreground font-bold text-[10px] rounded-full border-2 border-background">
                                        {thread.unreadCount}
                                    </Badge>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <p className={cn("font-bold text-base truncate", thread.unreadCount > 0 && "text-primary")}>
                                        {thread.lastMessage.senderName}
                                    </p>
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {safeToDate(thread.lastMessage.timestamp) ? format(safeToDate(thread.lastMessage.timestamp)!, 'HH:mm • d MMM') : 'Recently'}
                                    </span>
                                </div>
                                <p className={cn("text-sm line-clamp-1 italic", thread.unreadCount > 0 ? "text-foreground font-bold" : "text-muted-foreground")}>
                                    "{thread.lastMessage.content}"
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                    <Badge variant="outline" className="text-[8px] uppercase font-bold tracking-widest bg-background py-0 h-5 border-primary/20">
                                        {thread.propertyId ? <><Home className="h-2.5 w-2.5 mr-1" /> Linked Asset</> : 'Direct Contact'}
                                    </Badge>
                                    <span className="text-[9px] font-bold text-primary truncate max-w-[200px]">Audit Registry Enabled</span>
                                </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-20 group-hover:opacity-100 transition-opacity" />
                        </div>
                    </Card>
                </Link>
            ))}
        </div>
      )}
      
      <div className="p-6 rounded-2xl bg-muted/30 border border-dashed flex items-center gap-4 text-left">
          <ShieldCheck className="h-10 w-10 text-primary opacity-20 shrink-0" />
          <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Legal & Compliance Audit</p>
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed font-medium">All communication via the Resident Hub is chronologically archived and cryptographically linked to your property assets for professional audit trail requirements.</p>
          </div>
      </div>
    </div>
  );
}
