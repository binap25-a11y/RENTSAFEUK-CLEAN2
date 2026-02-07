'use client';

import { useMemo } from 'react';
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
import { collection, query, where, Timestamp, collectionGroup } from 'firebase/firestore';
import { format, isBefore, addDays, isFuture } from 'date-fns';

// Interfaces
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
  expiryDate: Timestamp | Date;
}

interface Inspection {
  id: string;
  propertyId: string;
  inspectionType?: string;
  type: string;
  status: string;
  scheduledDate: Timestamp | Date;
}

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

  // Optimized high-performance listeners (Simplified filters to avoid index requirement)
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid));
  }, [firestore, user]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'documents'), 
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: allDocuments, isLoading: isLoadingDocs } = useCollection<Document>(docsQuery);

  const inspsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'inspections'), 
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);
  const { data: allInspections, isLoading: isLoadingInsps } = useCollection<Inspection>(inspsQuery);

  const propertyMap = useMemo(() => {
    return properties?.reduce((map, prop) => {
      map[prop.id] = prop.address ? [prop.address.nameOrNumber, prop.address.street].filter(Boolean).join(', ') : 'Unknown';
      return map;
    }, {} as Record<string, string>) ?? {};
  }, [properties]);
  
  const allReminders = useMemo(() => {
    const documentReminders = allDocuments
        ?.map((doc) => {
          if (!doc.expiryDate) return null;
          const expiry = doc.expiryDate instanceof Date ? doc.expiryDate : (doc.expiryDate as Timestamp).toDate();
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
          href: '/dashboard/documents'
        })) ?? [];

    const inspectionReminders = allInspections
        ?.filter((insp) => {
          if (!insp.scheduledDate || insp.status !== 'Scheduled') return false;
          const scheduled = insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate();
          return isFuture(scheduled);
        })
        .map((insp) => ({
          id: `insp-${insp.id}`,
          description: insp.inspectionType || insp.type || 'Inspection',
          property: propertyMap[insp.propertyId] || 'Portfolio',
          dueDate: insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate(),
          status: 'Scheduled',
          icon: CalendarClock,
          href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}`
        })) ?? [];

    return [...documentReminders, ...inspectionReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, propertyMap]);

  const isLoading = isLoadingDocs || isLoadingInsps;
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
                            <p className="text-[10px] text-muted-foreground/70">Due: {format(reminder.dueDate, 'PPP')}</p>
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
