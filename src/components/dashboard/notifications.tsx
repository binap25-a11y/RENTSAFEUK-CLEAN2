
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
import { Bell, FileWarning, CalendarClock, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, Timestamp, onSnapshot } from 'firebase/firestore';
import { format, isBefore, addDays, isFuture } from 'date-fns';

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
  };
}

interface Document {
  id: string;
  title: string;
  propertyId: string;
  expiryDate: Timestamp | Date | { seconds: number; nanoseconds: number };
}

interface Inspection {
  id: string;
  propertyId: string;
  inspectionType?: string;
  type: string;
  status: string;
  scheduledDate: Timestamp | Date | { seconds: number; nanoseconds: number };
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

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'userProfiles', user.uid, 'properties'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [isLoadingAggregates, setIsLoadingAggregates] = useState(false);

  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) {
        setAllDocuments([]);
        setAllInspections([]);
        return;
    }

    setIsLoadingAggregates(true);
    const unsubs: (() => void)[] = [];
    const docMap: Record<string, Document[]> = {};
    const inspMap: Record<string, Inspection[]> = {};

    const updateState = () => {
        setAllDocuments(Object.values(docMap).flat());
        setAllInspections(Object.values(inspMap).flat());
        setIsLoadingAggregates(false);
    };

    properties.forEach(prop => {
        const ownerFilter = where('ownerId', '==', user.uid);
        unsubs.push(onSnapshot(query(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'documents'), ownerFilter), (snap) => {
            docMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
            updateState();
        }));
        unsubs.push(onSnapshot(query(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'inspections'), ownerFilter), (snap) => {
            inspMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Inspection));
            updateState();
        }));
    });

    return () => unsubs.forEach(u => u());
  }, [user, properties, firestore]);

  const propertyMap = useMemo(() => {
    return properties?.reduce((map, prop) => {
      map[prop.id] = prop.address ? [prop.address.nameOrNumber, prop.address.street].filter(Boolean).join(', ') : 'Unknown';
      return map;
    }, {} as Record<string, string>) ?? {};
  }, [properties]);
  
  const allReminders = useMemo(() => {
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
          property: propertyMap[doc.propertyId] || 'Portfolio',
          dueDate: doc.expiryDate,
          status: doc.status,
          icon: FileWarning,
          href: `/dashboard/documents?propertyId=${doc.propertyId}`
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
          property: propertyMap[insp.propertyId] || 'Portfolio',
          dueDate: insp.scheduledDate,
          status: 'Scheduled',
          icon: CalendarClock,
          href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}`
        }));

    return [...documentReminders, ...inspectionReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, propertyMap]);

  const notificationCount = allReminders.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          {isLoadingAggregates ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Bell className="h-5 w-5" />}
          {notificationCount > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]" variant="destructive">
              {notificationCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold leading-none">Notifications</p>
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
                        <div className="flex items-center gap-2 w-full">
                            <reminder.icon className={`h-4 w-4 ${reminder.status === 'Expired' ? 'text-destructive' : 'text-yellow-500'}`}/>
                            <p className="font-semibold text-sm truncate flex-1">{reminder.description}</p>
                            <Badge variant={reminder.status === 'Expired' ? 'destructive' : 'secondary'} className="text-[10px] h-5">{reminder.status}</Badge>
                        </div>
                        <div className="pl-6 space-y-0.5">
                            <p className="text-[11px] text-muted-foreground font-medium">{reminder.property}</p>
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
