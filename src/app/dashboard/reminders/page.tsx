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
import { Download, Loader2, FileWarning, CalendarClock, Activity, Banknote, BellRing, Sparkles } from 'lucide-react';
import { format, isBefore, addDays, isFuture, setDate, isPast, startOfMonth, differenceInDays } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, Timestamp, onSnapshot, doc, updateDoc, limit } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from '@/hooks/use-toast';

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
  documentType: string;
}

interface Inspection {
  id: string;
  propertyId: string;
  inspectionType?: string;
  type: string;
  status: string;
  scheduledDate: Timestamp | Date | { seconds: number; nanoseconds: number };
}

interface Tenant {
    id: string;
    name: string;
    email: string;
    propertyId: string;
    monthlyRent?: number;
    rentDueDay?: number;
    status: string;
    lastReminderSent?: any;
}

interface RentPayment {
    id: string;
    propertyId: string;
    month: string;
    year: number;
    status: string;
}

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const getDocumentStatus = (expiryDate: Date, today: Date) => {
  const ninetyDaysFromNow = addDays(today, 90);
  if (isBefore(expiryDate, today)) return 'Expired';
  if (isBefore(expiryDate, ninetyDaysFromNow)) return 'Expiring Soon';
  return 'Valid';
};

const getStatusVariant = (status: string): "destructive" | "secondary" | "outline" => {
  switch (status) {
    case 'Expired': 
    case 'Overdue': return 'destructive';
    case 'Expiring Soon':
    case 'Upcoming':
    case 'Scheduled': return 'secondary';
    default: return 'outline';
  }
};

export default function RemindersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => { setToday(new Date()); }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'userProfiles', user.uid, 'properties'), where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']), limit(100));
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [allRentPayments, setAllRentPayments] = useState<RentPayment[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);

  useEffect(() => {
    if (!user || !firestore || !properties || properties.length === 0) {
        setAllDocuments([]);
        setAllInspections([]);
        setAllTenants([]);
        setAllRentPayments([]);
        return;
    }

    setIsAggregating(true);
    const unsubs: (() => void)[] = [];
    const docMap: Record<string, Document[]> = {};
    const inspMap: Record<string, Inspection[]> = {};
    const tenantMap: Record<string, Tenant[]> = {};
    const paymentMap: Record<string, RentPayment[]> = {};

    const updateState = () => {
        setAllDocuments(Object.values(docMap).flat());
        setAllInspections(Object.values(inspMap).flat());
        setAllTenants(Object.values(tenantMap).flat());
        setAllRentPayments(Object.values(paymentMap).flat());
        setIsAggregating(false);
    };

    properties.forEach(prop => {
        unsubs.push(onSnapshot(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'documents'), (snap) => {
            docMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
            updateState();
        }));
        unsubs.push(onSnapshot(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'inspections'), (snap) => {
            inspMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Inspection));
            updateState();
        }));
        unsubs.push(onSnapshot(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'tenants'), (snap) => {
            tenantMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Tenant));
            updateState();
        }));
        unsubs.push(onSnapshot(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'rentPayments'), (snap) => {
            paymentMap[prop.id] = snap.docs.map(d => ({ id: d.id, ...d.data() } as RentPayment));
            updateState();
        }));
    });

    return () => unsubs.forEach(u => u());
  }, [user, properties, firestore]);

  const propertyMap = useMemo(() => {
    return properties?.reduce((map, prop) => {
      map[prop.id] = prop.address ? [prop.address.nameOrNumber, prop.address.street, prop.address.city].filter(Boolean).join(', ') : 'Unknown';
      return map;
    }, {} as Record<string, string>) ?? {};
  }, [properties]);

  const allReminders = useMemo(() => {
    if (!today) return [];
    
    const documentReminders = allDocuments
        .map((doc) => {
          const expiry = toDate(doc.expiryDate);
          if (!expiry) return null;
          return { ...doc, expiryDate: expiry, status: getDocumentStatus(expiry, today) };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null && doc.status !== 'Valid')
        .map((doc) => ({ id: `doc-${doc.id}`, type: 'Compliance', description: doc.title, category: doc.documentType, property: propertyMap[doc.propertyId] || 'Unknown', dueDate: doc.expiryDate, status: doc.status, href: `/dashboard/documents?propertyId=${doc.propertyId}` }));

    const inspectionReminders = allInspections
        .map((insp) => {
          const scheduled = toDate(insp.scheduledDate);
          if (!scheduled || insp.status !== 'Scheduled') return null;
          return { ...insp, scheduledDate: scheduled };
        })
        .filter((insp): insp is NonNullable<typeof insp> => insp !== null && isFuture(insp.scheduledDate))
        .map((insp) => ({ id: `insp-${insp.id}`, type: 'Task', description: insp.inspectionType || insp.type || 'Inspection', category: 'Routine Check', property: propertyMap[insp.propertyId] || 'Unknown', dueDate: insp.scheduledDate, status: 'Scheduled', href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}` }));

    const rentReminders = allTenants
        .filter(t => t.status === 'Active' && t.rentDueDay)
        .map((tenant) => {
            const currentMonthName = format(today, 'MMMM');
            const currentYear = today.getFullYear();
            const isPaid = allRentPayments.some(p => p.propertyId === tenant.propertyId && p.month === currentMonthName && p.year === currentYear && p.status === 'Paid');
            
            if (isPaid) return null;

            let dueDate = setDate(startOfMonth(today), tenant.rentDueDay!);
            const status = isPast(dueDate) && dueDate.getDate() !== today.getDate() ? 'Overdue' : 'Upcoming';

            const addr = propertyMap[tenant.propertyId] || 'Property';
            const amount = tenant.monthlyRent?.toLocaleString() || '0';

            return {
                id: `rent-${tenant.id}`,
                type: 'Rent',
                description: `Rent due for ${addr} - £${amount}`,
                category: 'Financial',
                property: addr,
                dueDate: dueDate,
                status: status,
                href: `/dashboard/expenses`
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    return [...documentReminders, ...inspectionReminders, ...rentReminders].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [allDocuments, allInspections, allTenants, allRentPayments, propertyMap, today]);

  const automationReady = useMemo(() => {
    if (!today) return [];
    return allTenants.filter(tenant => {
        if (tenant.status !== 'Active' || !tenant.rentDueDay) return false;
        
        const currentMonthName = format(today, 'MMMM');
        const currentYear = today.getFullYear();
        const isPaid = allRentPayments.some(p => p.propertyId === tenant.propertyId && p.month === currentMonthName && p.year === currentYear && p.status === 'Paid');
        if (isPaid) return false;

        const dueDate = setDate(startOfMonth(today), tenant.rentDueDay);
        const daysToDue = differenceInDays(dueDate, today);
        
        // Automation triggers if overdue OR due in 3 days, AND not nudged in the last 7 days
        const lastNudged = toDate(tenant.lastReminderSent);
        const hasBeenNudgedRecently = lastNudged && differenceInDays(today, lastNudged) < 7;

        return (isPast(dueDate) || daysToDue <= 3) && !hasBeenNudgedRecently;
    });
  }, [allTenants, allRentPayments, today]);

  const handleSendReminder = async (tenant: Tenant) => {
    if (!user || !firestore) return;
    
    const propertyAddr = propertyMap[tenant.propertyId] || 'Assigned Property';
    const subject = encodeURIComponent(`Rent Reminder: ${propertyAddr}`);
    const body = encodeURIComponent(`Hi ${tenant.name},\n\nThis is an automated reminder regarding the rent for ${propertyAddr}.\n\nMonthly Rent: £${tenant.monthlyRent?.toLocaleString() || '0'}\nDue Day: ${tenant.rentDueDay}${tenant.rentDueDay === 1 ? 'st' : 'th'} of the month.\n\nIf you have already made this payment, please disregard this message.\n\nBest regards,\nRentSafeUK Portfolio Management`);
    
    window.location.href = `mailto:${tenant.email}?subject=${subject}&body=${body}`;
    
    // Update last reminder date
    const tenantRef = doc(firestore, 'userProfiles', user.uid, 'properties', tenant.propertyId, 'tenants', tenant.id);
    await updateDoc(tenantRef, { lastReminderSent: new Date().toISOString() });
    
    toast({ title: 'Reminder Prepared', description: 'Opening email client for review.' });
  };

  const generateComplianceReport = () => {
    const pdfDoc = new jsPDF();
    pdfDoc.setFontSize(20); 
    pdfDoc.text('Portfolio Health Report', 14, 22);
    pdfDoc.setFontSize(10); 
    pdfDoc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
    const complianceData = allReminders.map(r => [r.property, r.type, r.description, format(r.dueDate, 'dd/MM/yyyy'), r.status]);
    autoTable(pdfDoc, { 
        startY: 40, 
        head: [['Property', 'Type', 'Details', 'Due Date', 'Status']], 
        body: complianceData, 
        theme: 'grid', 
        headStyles: { fillColor: [38, 102, 114] } 
    });
    pdfDoc.save('Portfolio-Compliance-Health.pdf');
  };

  const urgentCount = useMemo(() => allReminders.filter(r => r.status === 'Expired' || r.status === 'Overdue').length, [allReminders]);
  const upcomingCount = useMemo(() => allReminders.filter(r => r.status === 'Expiring Soon' || r.status === 'Upcoming' || r.status === 'Scheduled').length, [allReminders]);
  const isLoading = isLoadingProps || isAggregating || !today;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-none shadow-md overflow-hidden relative">
            <div className="h-1 bg-destructive w-full absolute top-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Critical / Overdue</CardTitle>
                <FileWarning className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-destructive">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : urgentCount}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Needs immediate attention</p>
            </CardContent>
        </Card>
        <Card className="border-none shadow-md overflow-hidden relative">
            <div className="h-1 bg-blue-500 w-full absolute top-0" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Upcoming Schedule</CardTitle>
                <CalendarClock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold text-blue-600">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : upcomingCount}</div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Due next 30-90 days</p>
            </CardContent>
        </Card>
      </div>

      {automationReady.length > 0 && (
        <Card className="border-primary/20 bg-primary/[0.02] shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <BellRing className="h-5 w-5" />
                    Rent Automation Hub
                </CardTitle>
                <CardDescription>System identified {automationReady.length} overdue or upcoming rent nudges ready to send.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {automationReady.map(tenant => (
                        <div key={tenant.id} className="flex items-center justify-between p-4 bg-background border rounded-xl shadow-sm">
                            <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{tenant.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">{propertyMap[tenant.propertyId]}</p>
                            </div>
                            <Button size="sm" onClick={() => handleSendReminder(tenant)} className="font-bold uppercase text-[10px] h-8 px-4 gap-2">
                                <BellRing className="h-3 w-3" /> Nudge Now
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <CardTitle className="text-xl font-headline">Action Registry</CardTitle>
                    <CardDescription>Consolidated view of rent due dates, compliance, and tasks.</CardDescription>
                </div>
                <Button onClick={generateComplianceReport} disabled={isLoading} className="font-bold shadow-lg h-10 px-6">
                    <Activity className="mr-2 h-4 w-4" /> Export Health PDF
                </Button>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? ( 
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> 
          ) : allReminders.length === 0 ? ( 
            <div className="py-32 text-center flex flex-col justify-center items-center text-muted-foreground italic bg-muted/5">
                <div className="bg-background p-6 rounded-full shadow-sm mb-4">
                    <CalendarClock className="h-12 w-12 opacity-10" />
                </div>
                <p className="font-bold text-foreground">You're all caught up!</p>
                <p className="text-sm">No critical compliance or rent tasks found.</p>
            </div> 
          ) : (
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="pl-6 font-bold uppercase tracking-wider text-[10px]">Type</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-[10px]">Issue / Task</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-[10px]">Location</TableHead>
                            <TableHead className="font-bold uppercase tracking-wider text-[10px]">Status</TableHead>
                            <TableHead className="text-right pr-6 font-bold uppercase tracking-wider text-[10px]">Target Date</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allReminders.map((reminder) => (
                            <TableRow key={reminder.id} className="hover:bg-muted/30 transition-colors group">
                                <TableCell className="pl-6">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">{reminder.type}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold py-4">
                                    <Link href={reminder.href} className="hover:underline text-primary">{reminder.description}</Link>
                                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{reminder.category}</div>
                                </TableCell>
                                <TableCell className="text-xs font-medium text-muted-foreground max-w-[200px] truncate">
                                    {reminder.property}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(reminder.status)} className="text-[10px] font-bold uppercase px-3 py-1 rounded-lg">
                                        {reminder.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6 font-bold text-sm tabular-nums">
                                    {format(reminder.dueDate, 'dd/MM/yyyy')}
                                </TableCell>
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
