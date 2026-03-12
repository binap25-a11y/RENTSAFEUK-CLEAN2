
'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, FileWarning, CalendarClock, Banknote } from 'lucide-react';
import { format, isBefore, addDays, isFuture, setDate, isPast, startOfMonth } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';

interface DocumentRecord {
  id: string;
  title: string;
  propertyId: string;
  landlordId: string;
  expiryDate: any;
  documentType: string;
}

interface InspectionRecord {
  id: string;
  propertyId: string;
  landlordId: string;
  type: string;
  status: string;
  scheduledDate: any;
}

interface TenantRecord {
    id: string;
    name: string;
    email: string;
    propertyId: string;
    landlordId: string;
    monthlyRent?: number;
    rentDueDay?: number;
    status: string;
}

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function RemindersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => { setToday(new Date()); }, []);

  // 1. Fetch data using flat root collection queries
  const docsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'documents'), where('landlordId', '==', user.uid));
  }, [firestore, user]);
  const { data: allDocuments, isLoading: isLoadingDocs } = useCollection<DocumentRecord>(docsQuery);

  const inspQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'inspections'), where('landlordId', '==', user.uid), where('status', '==', 'Scheduled'));
  }, [firestore, user]);
  const { data: allInspections, isLoading: isLoadingInsp } = useCollection<InspectionRecord>(inspQuery);

  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'tenants'), where('landlordId', '==', user.uid), where('status', '==', 'Active'));
  }, [firestore, user]);
  const { data: allTenants, isLoading: isLoadingTenants } = useCollection<TenantRecord>(tenantsQuery);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid));
  }, [firestore, user]);
  const { data: properties } = useCollection<any>(propertiesQuery);

  const propertyMap = useMemo(() => {
    return properties?.reduce((map, prop) => {
      map[prop.id] = prop.address ? [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ') : 'Unknown';
      return map;
    }, {} as Record<string, string>) ?? {};
  }, [properties]);

  const allReminders = useMemo(() => {
    if (!today || !allDocuments || !allInspections || !allTenants) return [];
    
    const documentReminders = allDocuments
        .map((doc) => {
          const expiry = toDate(doc.expiryDate);
          if (!expiry) return null;
          const ninetyDaysFromNow = addDays(today, 90);
          let status = 'Valid';
          if (isBefore(expiry, today)) status = 'Expired';
          else if (isBefore(expiry, ninetyDaysFromNow)) status = 'Expiring Soon';
          
          if (status === 'Valid') return null;
          return { id: doc.id, type: 'Compliance', description: doc.title, category: doc.documentType, property: propertyMap[doc.propertyId] || 'Unknown', dueDate: expiry, status, href: `/dashboard/documents?propertyId=${doc.propertyId}` };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null);

    const inspectionReminders = allInspections
        .map((insp) => {
          const scheduled = toDate(insp.scheduledDate);
          if (!scheduled) return null;
          return { id: insp.id, type: 'Inspection', description: insp.type, category: 'Maintenance', property: propertyMap[insp.propertyId] || 'Unknown', dueDate: scheduled, status: 'Scheduled', href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}` };
        })
        .filter((insp): insp is NonNullable<typeof insp> => insp !== null);

    const rentReminders = allTenants
        .filter(t => t.rentDueDay)
        .map((tenant) => {
            let dueDate = setDate(startOfMonth(today), tenant.rentDueDay!);
            const status = isPast(dueDate) && dueDate.getDate() !== today.getDate() ? 'Overdue' : 'Upcoming';
            return {
                id: tenant.id,
                type: 'Rent',
                description: `Rent due for ${tenant.name}`,
                category: 'Financial',
                property: propertyMap[tenant.propertyId] || 'Assigned Property',
                dueDate: dueDate,
                status: status,
                href: `/dashboard/expenses`
            };
        });

    return [...documentReminders, ...inspectionReminders, ...rentReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, allTenants, propertyMap, today]);

  const isLoading = isLoadingDocs || isLoadingInsp || isLoadingTenants || !today;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
        <h1 className="text-3xl font-bold font-headline text-primary">Portfolio Registry</h1>
        <p className="text-muted-foreground font-medium">Automated tracking of rent due dates, compliance, and tasks.</p>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? ( 
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> 
          ) : allReminders.length === 0 ? ( 
            <div className="py-20 text-center text-muted-foreground italic bg-muted/5">No active alerts found.</div> 
          ) : (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Type</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-[10px]">Details</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-[10px]">Location</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status</TableHead>
                            <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">Due Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allReminders.map((reminder) => (
                            <TableRow key={reminder.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="pl-6 text-[10px] font-bold uppercase">{reminder.type}</TableCell>
                                <TableCell className="font-bold py-4">
                                    <Link href={reminder.href} className="hover:underline text-primary">{reminder.description}</Link>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase">{reminder.category}</div>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-muted-foreground truncate max-w-[200px]">{reminder.property}</TableCell>
                                <TableCell>
                                    <Badge variant={reminder.status === 'Expired' || reminder.status === 'Overdue' ? 'destructive' : 'secondary'} className="text-[10px] font-bold uppercase px-3 h-6">
                                        {reminder.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6 font-bold text-sm tabular-nums">{format(reminder.dueDate, 'dd/MM/yyyy')}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
