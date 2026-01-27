'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Bell, FileWarning, CalendarClock } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, isBefore, addDays, isFuture } from 'date-fns';

// Interfaces from other parts of the app
interface Property {
  id: string;
  address: string;
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

  if (isBefore(expiryDate, today)) {
    return 'Expired';
  }
  if (isBefore(expiryDate, ninetyDaysFromNow)) {
    return 'Expiring Soon';
  }
  return 'Valid';
};


export function Notifications() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoadingSubcollections, setIsLoadingSubcollections] = useState(true);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid));
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  useEffect(() => {
    if (!properties || !firestore) {
      setIsLoadingSubcollections(!properties);
      return;
    }

    if (properties.length === 0) {
      setDocuments([]);
      setInspections([]);
      setIsLoadingSubcollections(false);
      return;
    }

    const fetchSubcollections = async () => {
      setIsLoadingSubcollections(true);
      try {
        const documentPromises = properties.map(prop =>
          getDocs(collection(firestore, 'properties', prop.id, 'documents'))
        );
        const inspectionPromises = properties.map(prop =>
          getDocs(collection(firestore, 'properties', prop.id, 'inspections'))
        );

        const documentSnapshots = await Promise.all(documentPromises);
        const inspectionSnapshots = await Promise.all(inspectionPromises);

        const allDocs = documentSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document)));
        const allInspections = inspectionSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Inspection)));

        setDocuments(allDocs);
        setInspections(allInspections);
      } catch (e) {
        console.error("Error fetching notification data: ", e);
      } finally {
        setIsLoadingSubcollections(false);
      }
    };

    fetchSubcollections();
  }, [properties, firestore]);

  const propertyMap = useMemo(() => {
    return (
      properties?.reduce((map, prop) => {
        map[prop.id] = prop.address;
        return map;
      }, {} as Record<string, string>) ?? {}
    );
  }, [properties]);
  
  const allReminders = useMemo(() => {
    const documentReminders =
      documents
        ?.map((doc) => {
          const expiry =
            doc.expiryDate instanceof Date
              ? doc.expiryDate
              : (doc.expiryDate as Timestamp).toDate();
          return {
            ...doc,
            expiryDate: expiry,
            status: getDocumentStatus(expiry),
          };
        })
        .filter(
          (doc) => doc.status === 'Expired' || doc.status === 'Expiring Soon'
        )
        .map((doc) => ({
          id: `doc-${doc.id}`,
          type: 'Document',
          description: doc.title,
          property: propertyMap[doc.propertyId] || 'Unknown',
          dueDate: doc.expiryDate,
          status: doc.status,
          icon: FileWarning,
          href: '/dashboard/documents'
        })) ?? [];

    const inspectionReminders =
      inspections
        ?.filter((insp) => {
          const scheduled =
            insp.scheduledDate instanceof Date
              ? insp.scheduledDate
              : (insp.scheduledDate as Timestamp).toDate();
          return insp.status === 'Scheduled' && isFuture(scheduled);
        })
        .map((insp) => ({
          id: `insp-${insp.id}`,
          type: 'Inspection',
          description: insp.inspectionType || insp.type || 'Inspection',
          property: propertyMap[insp.propertyId] || 'Unknown',
          dueDate:
            insp.scheduledDate instanceof Date
              ? insp.scheduledDate
              : (insp.scheduledDate as Timestamp).toDate(),
          status: 'Scheduled',
          icon: CalendarClock,
          href: '/dashboard/inspections'
        })) ?? [];

    return [...documentReminders, ...inspectionReminders].sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
    );
  }, [documents, inspections, propertyMap]);

  const notificationCount = allReminders.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <Badge className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full p-0 text-xs" variant="destructive">
              {notificationCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium leading-none">Notifications</p>
            <Link href="/dashboard/reminders" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notificationCount === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No new notifications</p>
        ) : (
          allReminders.slice(0, 5).map((reminder) => (
            <DropdownMenuItem key={reminder.id} asChild>
                <Link href={reminder.href} className="flex flex-col items-start gap-1 p-2 w-full">
                    <div className="flex items-center gap-2 w-full">
                        <reminder.icon className="h-4 w-4 text-muted-foreground"/>
                        <p className="font-semibold text-sm truncate">{reminder.description}</p>
                        <Badge variant={reminder.status === 'Expired' || reminder.status === 'Due' ? 'destructive' : 'secondary'} className="ml-auto flex-shrink-0">{reminder.status}</Badge>
                    </div>
                    <div className="pl-6 text-xs text-muted-foreground">
                        <p>{reminder.property}</p>
                        <p>Due: {format(reminder.dueDate, 'PPP')}</p>
                    </div>
                </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
