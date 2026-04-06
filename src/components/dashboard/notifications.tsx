'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, 
  FileWarning, 
  CalendarClock, 
  Loader2, 
  Banknote, 
  MessageSquare, 
  Wrench, 
  RefreshCw, 
  MapPin, 
  X,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, onSnapshot, limit, doc, getDoc } from 'firebase/firestore';
import { format, isBefore, addDays, setDate, startOfMonth, isPast, isFuture } from 'date-fns';
import { safeToDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Universal Notification Bell
 * Aggregates alerts for both Landlords and Tenants.
 * Landlord: Compliance, Rent, Maintenance Requests, Messages.
 * Tenant: Repair Updates, Shared Docs, Management Messages, Inspections.
 */

export function Notifications() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [userRole, setUserRole] = useState<'landlord' | 'tenant' | null>(null);
  const [tenantPropertyId, setTenantPropertyId] = useState<string | null>(null);
  
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [allInspections, setAllInspections] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [allRentPayments, setAllRentPayments] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [allRepairs, setAllRepairs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // 1. Role Discovery & Handshake
  useEffect(() => {
    if (!user || !firestore) return;
    
    const resolveRole = async () => {
        setIsLoading(true);
        try {
            const userRef = doc(firestore, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const role = userSnap.data().role;
                setUserRole(role);

                // If tenant, find their assigned property
                if (role === 'tenant') {
                    const tenantsCol = collection(firestore, 'tenants');
                    const q = query(tenantsCol, where('email', '==', user.email?.toLowerCase().trim()), limit(1));
                    const unsub = onSnapshot(q, (snap) => {
                        if (!snap.empty) {
                            setTenantPropertyId(snap.docs[0].data().propertyId);
                        }
                    });
                    return () => unsub();
                }
            }
        } catch (e) {
            console.error("Notification role resolution failed:", e);
        } finally {
            setIsLoading(false);
        }
    };
    resolveRole();
  }, [user, firestore]);

  // 2. Local Persistence Handshake
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dismissed_notifications');
      if (saved) {
        try { setDismissedIds(new Set(JSON.parse(saved))); } catch (e) {}
      }
    }
  }, []);

  const dismissNotification = (id: string) => {
    const newDismissed = new Set(dismissedIds);
    newDismissed.add(id);
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissed_notifications', JSON.stringify(Array.from(newDismissed)));
  };

  const clearAllNotifications = () => {
    const allIds = allReminders.map(r => r.id);
    const newDismissed = new Set([...Array.from(dismissedIds), ...allIds]);
    setDismissedIds(newDismissed);
    localStorage.setItem('dismissed_notifications', JSON.stringify(Array.from(newDismissed)));
  };

  // 3. Real-time Registry Sync
  useEffect(() => {
    if (!user || !firestore || !userRole) return;

    const listeners: (() => void)[] = [];
    const handleError = (path: string) => async (err: any) => {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path, operation: 'list' }));
      }
    };

    if (userRole === 'landlord') {
        const qProps = query(collection(firestore, 'properties'), where('landlordId', '==', user.uid), limit(100));
        const qDocs = query(collection(firestore, 'documents'), where('landlordId', '==', user.uid), limit(50));
        const qInsp = query(collection(firestore, 'inspections'), where('landlordId', '==', user.uid), limit(50));
        const qTenants = query(collection(firestore, 'tenants'), where('landlordId', '==', user.uid), where('status', '==', 'Active'));
        const qMsgs = query(collection(firestore, 'messages'), where('landlordId', '==', user.uid), limit(20));
        const qRepairs = query(collection(firestore, 'repairs'), where('landlordId', '==', user.uid), where('status', '==', 'Open'), limit(20));

        listeners.push(onSnapshot(qProps, (s) => setAllProperties(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('properties')));
        listeners.push(onSnapshot(qDocs, (s) => setAllDocuments(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('documents')));
        listeners.push(onSnapshot(qInsp, (s) => setAllInspections(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('inspections')));
        listeners.push(onSnapshot(qTenants, (s) => setAllTenants(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('tenants')));
        listeners.push(onSnapshot(qMsgs, (s) => setAllMessages(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('messages')));
        listeners.push(onSnapshot(qRepairs, (s) => setAllRepairs(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('repairs')));
    } else if (userRole === 'tenant' && tenantPropertyId) {
        // Tenant Mode: Focus on their property
        const qDocs = query(collection(firestore, 'documents'), where('propertyId', '==', tenantPropertyId), where('sharedWithTenant', '==', true), limit(20));
        const qMsgs = query(collection(firestore, 'messages'), where('propertyId', '==', tenantPropertyId), where('tenantUid', '==', user.uid), limit(20));
        const qRepairs = query(collection(firestore, 'repairs'), where('propertyId', '==', tenantPropertyId), limit(20));
        const qInsp = query(collection(firestore, 'inspections'), where('propertyId', '==', tenantPropertyId), where('status', '==', 'Scheduled'), limit(10));

        listeners.push(onSnapshot(qDocs, (s) => setAllDocuments(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('documents')));
        listeners.push(onSnapshot(qMsgs, (s) => setAllMessages(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('messages')));
        listeners.push(onSnapshot(qRepairs, (s) => setAllRepairs(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('repairs')));
        listeners.push(onSnapshot(qInsp, (s) => setAllInspections(s.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('inspections')));
    }

    return () => listeners.forEach(u => u());
  }, [user, firestore, userRole, tenantPropertyId]);

  const propertyMap = useMemo(() => {
    return allProperties.reduce((acc, p) => {
        acc[p.id] = [p.address?.nameOrNumber, p.address?.street].filter(Boolean).join(' ');
        return acc;
    }, {} as Record<string, string>);
  }, [allProperties]);

  const allReminders = useMemo(() => {
    const today = new Date();
    const reminders: any[] = [];

    if (userRole === 'landlord') {
        // 1. Compliance (Landlord)
        allDocuments.forEach(doc => {
            const expiry = safeToDate(doc.expiryDate);
            if (!expiry) return;
            const status = isBefore(expiry, today) ? 'Expired' : (isBefore(expiry, addDays(today, 90)) ? 'Expiring Soon' : 'Valid');
            if (status !== 'Valid') reminders.push({ id: `doc-${doc.id}`, description: doc.title, address: propertyMap[doc.propertyId] || 'Asset', dueDate: expiry, status, icon: FileWarning, href: `/dashboard/documents?propertyId=${doc.propertyId}` });
        });
        // 2. Repairs (Landlord)
        allRepairs.forEach(r => reminders.push({ id: `repair-${r.id}`, description: `New Request: ${r.title}`, address: propertyMap[r.propertyId] || 'Asset', dueDate: safeToDate(r.reportedDate) || today, status: r.priority, icon: Wrench, href: `/dashboard/maintenance/${r.id}?propertyId=${r.propertyId}` }));
        // 3. Messages (Landlord)
        allMessages.filter(m => m.senderId !== user?.uid && !m.read).forEach(m => reminders.push({ id: `msg-${m.id}`, description: `From ${m.senderName}`, address: propertyMap[m.propertyId] || 'Asset', dueDate: safeToDate(m.timestamp) || today, status: 'New', icon: MessageSquare, href: `/dashboard/properties/${m.propertyId}?tab=messages` }));
    } else if (userRole === 'tenant') {
        // 1. Shared Documents (Tenant)
        allDocuments.forEach(doc => reminders.push({ id: `doc-${doc.id}`, description: `New Document Shared: ${doc.title}`, address: 'Compliance Vault', dueDate: safeToDate(doc.issueDate) || today, status: 'Shared', icon: FileText, href: '/tenant/documents' }));
        // 2. Messages (Tenant)
        allMessages.filter(m => m.senderId !== user?.uid && !m.read).forEach(m => reminders.push({ id: `msg-${m.id}`, description: `New Message from Management`, address: 'Support Channel', dueDate: safeToDate(m.timestamp) || today, status: 'Unread', icon: MessageSquare, href: '/tenant/messages' }));
        // 3. Inspections (Tenant)
        allInspections.forEach(i => reminders.push({ id: `insp-${i.id}`, description: `Upcoming ${i.type || 'Visit'}`, address: 'Property Visit', dueDate: safeToDate(i.scheduledDate) || today, status: 'Scheduled', icon: CalendarClock, href: '/tenant/dashboard' }));
        // 4. Repairs (Tenant Status Change)
        allRepairs.filter(r => r.status === 'In Progress').forEach(r => reminders.push({ id: `rep-upd-${r.id}`, description: `Repair Status: ${r.status}`, address: r.title, dueDate: today, status: 'Updating', icon: Wrench, href: '/tenant/dashboard' }));
    }

    return reminders
        .filter(r => !dismissedIds.has(r.id))
        .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  }, [allDocuments, allInspections, allTenants, allRentPayments, allMessages, allRepairs, propertyMap, user, userRole, dismissedIds]);

  const notificationCount = allReminders.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-primary/5 transition-colors">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Bell className="h-5 w-5 text-muted-foreground" />}
          {notificationCount > 0 && (
            <Badge className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px] font-bold border-2 border-background animate-in zoom-in" variant="destructive">
              {notificationCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96 text-left p-0 overflow-hidden shadow-2xl border-none rounded-2xl" align="end" forceMount>
        <DropdownMenuLabel className="p-4 bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 text-left">
                <p className="text-sm font-bold leading-none">Activity Feed</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{notificationCount} pending items</p>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10" onClick={clearAllNotifications}>
                    Clear All
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-3.5 w-3.5" />
                </Button>
            </div>
          </div>
        </DropdownMenuLabel>
        <div className="max-h-[450px] overflow-y-auto bg-card">
            {notificationCount === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4 px-10">
                  <div className="p-6 rounded-full bg-primary/5">
                    <CheckCircle2 className="h-10 w-10 text-primary opacity-20" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">All Caught Up</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">No new notifications in your portfolio audit trail.</p>
                  </div>
              </div>
            ) : (
              <div className="divide-y divide-muted/50">
                {allReminders.map((reminder) => (
                    <div 
                        key={reminder.id} 
                        className="relative group transition-all hover:bg-muted/30 flex items-start p-4 gap-4 cursor-pointer"
                        onClick={() => window.location.href = reminder.href}
                    >
                        <div className={cn(
                            "p-2.5 rounded-xl shrink-0 mt-0.5",
                            reminder.status === 'Expired' || reminder.status === 'Overdue' || reminder.status === 'Emergency' 
                                ? "bg-destructive/10 text-destructive" 
                                : "bg-primary/10 text-primary"
                        )}>
                            <reminder.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 pr-6 text-left">
                            <div className="flex items-center gap-2 mb-1 text-left">
                                <p className="font-bold text-sm truncate leading-none text-left">{reminder.description}</p>
                                <Badge variant={reminder.status === 'Expired' || reminder.status === 'Overdue' ? 'destructive' : 'secondary'} className="text-[8px] h-4 px-1.5 uppercase font-bold tracking-tighter">
                                    {reminder.status}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tight mb-1 truncate text-left">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {reminder.address}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 text-left">
                                <CalendarClock className="h-3 w-3" />
                                {format(reminder.dueDate, 'd MMM yyyy')}
                            </p>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive rounded-full" 
                            onClick={(e) => {
                                e.stopPropagation();
                                dismissNotification(reminder.id);
                            }}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}
              </div>
            )}
        </div>
        <div className="p-3 bg-muted/5">
            <Button variant="link" className="w-full text-[10px] font-bold uppercase tracking-widest text-primary h-auto p-0" asChild>
                <Link href={userRole === 'tenant' ? "/tenant/dashboard" : "/dashboard/reminders"}>View Activity History</Link>
            </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
