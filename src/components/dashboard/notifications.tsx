
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
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
  History,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { format, isBefore, addDays, setDate, startOfMonth, isPast, isFuture } from 'date-fns';
import { safeToDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Dashboard Notification Bell
 * Aggregates alerts from across the portfolio including compliance, rent, and messages.
 * Includes property address mapping and dismissal logic.
 */

export function Notifications() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [allInspections, setAllInspections] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [allRentPayments, setAllRentPayments] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [allRepairs, setAllRepairs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // HYDRATION HANDSHAKE: Load dismissed alerts from local session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dismissed_notifications');
      if (saved) {
        try {
            setDismissedIds(new Set(JSON.parse(saved)));
        } catch (e) {
            console.error("Failed to parse dismissed alerts", e);
        }
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

  useEffect(() => {
    if (!user || !firestore) return;

    setIsLoading(true);
    
    // Root Collection discovery queries
    const qProps = query(collection(firestore, 'properties'), where('landlordId', '==', user.uid), limit(100));
    const qDocs = query(collection(firestore, 'documents'), where('landlordId', '==', user.uid), limit(50));
    const qInsp = query(collection(firestore, 'inspections'), where('landlordId', '==', user.uid), limit(50));
    const qTenants = query(collection(firestore, 'tenants'), where('landlordId', '==', user.uid), where('status', '==', 'Active'));
    const qRent = query(collection(firestore, 'rentPayments'), where('landlordId', '==', user.uid), limit(50));
    const qMsgs = query(collection(firestore, 'messages'), where('landlordId', '==', user.uid), limit(20));
    const qRepairs = query(collection(firestore, 'repairs'), where('landlordId', '==', user.uid), where('status', '==', 'Open'), limit(20));

    const handleError = (path: string) => async (err: any) => {
      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path,
          operation: 'list'
        }));
      }
    };

    const unsubProps = onSnapshot(qProps, (snap) => setAllProperties(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('properties'));
    const unsubDocs = onSnapshot(qDocs, (snap) => setAllDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('documents'));
    const unsubInsp = onSnapshot(qInsp, (snap) => setAllInspections(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('inspections'));
    const unsubTenants = onSnapshot(qTenants, (snap) => setAllTenants(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('tenants'));
    const unsubRent = onSnapshot(qRent, (snap) => setAllRentPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('rentPayments'));
    const unsubMsgs = onSnapshot(qMsgs, (snap) => setAllMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('messages'));
    const unsubRepairs = onSnapshot(qRepairs, (snap) => setAllRepairs(snap.docs.map(d => ({ id: d.id, ...d.data() }))), handleError('repairs'));

    setIsLoading(false);

    return () => {
        unsubProps();
        unsubDocs();
        unsubInsp();
        unsubTenants();
        unsubRent();
        unsubMsgs();
        unsubRepairs();
    };
  }, [user, firestore]);

  const propertyMap = useMemo(() => {
    return allProperties.reduce((acc, p) => {
        acc[p.id] = [p.address?.nameOrNumber, p.address?.street].filter(Boolean).join(' ');
        return acc;
    }, {} as Record<string, string>);
  }, [allProperties]);

  const allReminders = useMemo(() => {
    const today = new Date();
    
    const documentReminders = allDocuments
        .map((doc) => {
          const expiry = safeToDate(doc.expiryDate);
          if (!expiry) return null;
          const ninetyDaysFromNow = addDays(today, 90);
          let status = 'Valid';
          if (isBefore(expiry, today)) status = 'Expired';
          else if (isBefore(expiry, ninetyDaysFromNow)) status = 'Expiring Soon';
          return { ...doc, expiryDate: expiry, status };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null && (doc.status === 'Expired' || doc.status === 'Expiring Soon'))
        .map((doc) => ({
          id: `doc-${doc.id}`,
          description: doc.title,
          address: propertyMap[doc.propertyId] || 'Assigned Property',
          dueDate: doc.expiryDate,
          status: doc.status,
          icon: FileWarning,
          href: `/dashboard/documents?propertyId=${doc.propertyId}`
        }));

    const inspectionReminders = allInspections
        .map((insp) => {
          const scheduled = safeToDate(insp.scheduledDate);
          if (!scheduled || insp.status !== 'Scheduled') return null;
          return { ...insp, scheduledDate: scheduled };
        })
        .filter((insp): insp is NonNullable<typeof insp> => insp !== null && isFuture(insp.scheduledDate))
        .map((insp) => ({
          id: `insp-${insp.id}`,
          description: insp.inspectionType || insp.type || 'Inspection',
          address: propertyMap[insp.propertyId] || 'Assigned Property',
          dueDate: insp.scheduledDate,
          status: 'Scheduled',
          icon: CalendarClock,
          href: `/dashboard/inspections`
        }));

    const messageAlerts = allMessages
        .filter(msg => msg.senderId !== user?.uid && msg.read !== true)
        .map((msg) => ({
            id: `msg-${msg.id}`,
            description: `Message from ${msg.senderName}`,
            address: propertyMap[msg.propertyId] || 'Assigned Property',
            dueDate: safeToDate(msg.timestamp) || today,
            status: 'New',
            icon: MessageSquare,
            href: `/dashboard/properties/${msg.propertyId}?tab=messages`
        }));

    const repairAlerts = allRepairs.map((repair) => ({
        id: `repair-${repair.id}`,
        description: `New Request: ${repair.title}`,
        address: propertyMap[repair.propertyId] || 'Assigned Property',
        dueDate: safeToDate(repair.reportedDate) || today,
        status: repair.priority,
        icon: Wrench,
        href: `/dashboard/maintenance/${repair.id}?propertyId=${repair.propertyId}`
    }));

    const rentReminders = allTenants
        .filter(t => t.status === 'Active' && t.rentDueDay)
        .map((tenant) => {
            const currentMonthName = format(today, 'MMMM');
            const currentYear = today.getFullYear();
            const isPaid = allRentPayments.some(p => p.propertyId === tenant.propertyId && p.month === currentMonthName && p.year === currentYear && p.status === 'Paid');
            
            if (isPaid) return null;

            let dueDate = setDate(startOfMonth(today), tenant.rentDueDay!);
            const daysToDueLimit = addDays(today, 3);
            if (isFuture(dueDate) && isBefore(daysToDueLimit, dueDate)) return null;

            return {
                id: `rent-${tenant.id}-${currentMonthName}`,
                description: `Rent due for ${tenant.name}`,
                address: propertyMap[tenant.propertyId] || 'Assigned Property',
                dueDate: dueDate,
                status: isPast(dueDate) && dueDate.getDate() !== today.getDate() ? 'Overdue' : 'Due Soon',
                icon: Banknote,
                href: `/dashboard/expenses`
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    return [...documentReminders, ...inspectionReminders, ...rentReminders, ...messageAlerts, ...repairAlerts]
        .filter(r => !dismissedIds.has(r.id))
        .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  }, [allDocuments, allInspections, allTenants, allRentPayments, allMessages, allRepairs, propertyMap, user, dismissedIds]);

  const notificationCount = allReminders.length;

  const handleNotificationClick = (href: string) => {
    window.location.href = href;
  };

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
                <p className="text-sm font-bold leading-none">Portfolio Alerts</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{notificationCount} pending tasks</p>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10" onClick={clearAllNotifications}>
                    Dismiss All
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
                    <p className="font-bold text-foreground">Registry Clear</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">You're all caught up with your portfolio alerts and reminders.</p>
                  </div>
              </div>
            ) : (
              <div className="divide-y divide-muted/50">
                {allReminders.map((reminder) => (
                    <div 
                        key={reminder.id} 
                        className="relative group transition-all hover:bg-muted/30 flex items-start p-4 gap-4 cursor-pointer"
                        onClick={() => handleNotificationClick(reminder.href)}
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
                            <div className="flex items-center gap-2 mb-1">
                                <p className="font-bold text-sm truncate leading-none">{reminder.description}</p>
                                <Badge variant={reminder.status === 'Expired' || reminder.status === 'Overdue' || reminder.status === 'Emergency' ? 'destructive' : 'secondary'} className="text-[8px] h-4 px-1.5 uppercase font-bold tracking-tighter">
                                    {reminder.status}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-tight mb-1 truncate text-left">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {reminder.address}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 text-left">
                                <CalendarClock className="h-3 w-3" />
                                Ref: {format(reminder.dueDate, 'PPP')}
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
        {notificationCount > 0 && (
            <DropdownMenuSeparator className="m-0" />
        )}
        <div className="p-3 bg-muted/5">
            <Button variant="link" className="w-full text-[10px] font-bold uppercase tracking-widest text-primary h-auto p-0" asChild>
                <Link href="/dashboard/reminders">View Full Task Registry</Link>
            </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
