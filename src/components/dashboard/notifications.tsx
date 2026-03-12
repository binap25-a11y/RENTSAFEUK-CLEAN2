
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
import { Bell, FileWarning, CalendarClock, Loader2, Banknote } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { format, isBefore, addDays, isFuture, setDate, startOfMonth, isPast } from 'date-fns';

interface Message {
  id: string;
  description: string;
  dueDate: Date;
  status: string;
  icon: any;
  href: string;
}

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const getDocumentStatus = (expiryDate: Date) => {
  const today = new Date();
  const ninetyDaysFromNow = addDays(today, 90);
  if (isBefore(expiryDate, today)) return 'Expired';
  if (isBefore(expiryDate, ninetyDaysFromNow)) return 'Expiring Soon';
  return 'Valid';
};

export function Notifications() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [allInspections, setAllInspections] = useState<any[]>([]);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [allRentPayments, setAllRentPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user || !firestore) return;

    setIsLoading(true);
    
    // Professional Flat Collection Listeners
    const qDocs = query(collection(firestore, 'documents'), where('landlordId', '==', user.uid), limit(50));
    const qInsp = query(collection(firestore, 'inspections'), where('landlordId', '==', user.uid), limit(50));
    const qTenants = query(collection(firestore, 'tenants'), where('landlordId', '==', user.uid), where('status', '==', 'Active'));
    const qRent = query(collection(firestore, 'rentPayments'), where('landlordId', '==', user.uid), limit(50));

    const unsubDocs = onSnapshot(qDocs, (snap) => setAllDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubInsp = onSnapshot(qInsp, (snap) => setAllInspections(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubTenants = onSnapshot(qTenants, (snap) => setAllTenants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRent = onSnapshot(qRent, (snap) => setAllRentPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'rentPayments',
            operation: 'list',
        }));
    });

    setIsLoading(false);

    return () => {
        unsubDocs();
        unsubInsp();
        unsubTenants();
        unsubRent();
    };
  }, [user, firestore]);

  const allReminders = useMemo(() => {
    const today = new Date();
    
    const documentReminders = allDocuments
        .map((doc) => {
          const expiry = toDate(doc.expiryDate);
          if (!expiry) return null;
          return { ...doc, expiryDate: expiry, status: getDocumentStatus(expiry) };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null && (doc.status === 'Expired' || doc.status === 'Expiring Soon'))
        .map((doc) => ({
          id: `doc-${doc.id}`,
          description: doc.title,
          dueDate: doc.expiryDate,
          status: doc.status,
          icon: FileWarning,
          href: `/dashboard/documents`
        }));

    const inspectionReminders = allInspections
        .map((insp) => {
          const scheduled = toDate(insp.scheduledDate);
          if (!scheduled || insp.status !== 'Scheduled') return null;
          return { ...insp, scheduledDate: scheduled };
        })
        .filter((insp): insp is NonNullable<typeof insp> => insp !== null && isFuture(insp.scheduledDate))
        .map((insp) => ({
          id: `insp-${insp.id}`,
          description: insp.inspectionType || insp.type || 'Inspection',
          dueDate: insp.scheduledDate,
          status: 'Scheduled',
          icon: CalendarClock,
          href: `/dashboard/inspections`
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
                id: `rent-${tenant.id}`,
                description: `Rent due for ${tenant.name}`,
                dueDate: dueDate,
                status: isPast(dueDate) && dueDate.getDate() !== today.getDate() ? 'Overdue' : 'Due Soon',
                icon: Banknote,
                href: `/dashboard/expenses`
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    return [...documentReminders, ...inspectionReminders, ...rentReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, allTenants, allRentPayments]);

  const notificationCount = allReminders.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Bell className="h-5 w-5" />}
          {notificationCount > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]" variant="destructive">
              {notificationCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96 text-left" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold leading-none">Portfolio Alerts</p>
            <Link href="/dashboard/reminders" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
            {notificationCount === 0 ? (
              <div className="p-8 text-center">
                  <Bell className="h-8 w-8 mx-auto text-muted-foreground opacity-20 mb-2" />
                  <p className="text-sm text-muted-foreground italic">No new notifications</p>
              </div>
            ) : (
              allReminders.slice(0, 10).map((reminder) => (
                <DropdownMenuItem key={reminder.id} asChild className="cursor-pointer focus:bg-accent p-0">
                    <Link href={reminder.href} className="flex flex-col items-start gap-1 p-3 w-full border-b last:border-0">
                        <div className="flex items-center gap-2 w-full text-left">
                            <reminder.icon className={`h-4 w-4 shrink-0 ${reminder.status === 'Expired' || reminder.status === 'Overdue' ? 'text-destructive' : 'text-yellow-500'}`}/>
                            <p className="font-semibold text-sm truncate flex-1">{reminder.description}</p>
                            <Badge variant={reminder.status === 'Expired' || reminder.status === 'Overdue' ? 'destructive' : 'secondary'} className="text-[10px] h-5">{reminder.status}</Badge>
                        </div>
                        <div className="pl-6 space-y-0.5 text-left">
                            <p className="text-[10px] text-muted-foreground/70">Due: {format(reminder.dueDate, 'PP')}</p>
                        </div>
                    </Link>
                </DropdownMenuItem>
              ))
            )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
