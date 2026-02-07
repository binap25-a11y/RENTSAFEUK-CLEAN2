'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Home,
  Wrench,
  CalendarCheck,
  Files,
  Activity,
  ListTodo,
  Loader2,
  PoundSterling,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import { format, isFuture, isBefore, addDays } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Pie, PieChart, Cell } from 'recharts';

// Interfaces
interface Property {
  id: string;
  address: {
    street: string;
    city: string;
    county?: string;
    postcode: string;
  };
  status: string;
}

interface MaintenanceLog {
  id: string;
  title: string;
  propertyId: string;
  status: string;
  reportedDate: Timestamp | Date | { seconds: number; nanoseconds: number };
}

interface Inspection {
  id: string;
  type: string;
  propertyId: string;
  status: string;
  scheduledDate: Timestamp | Date | { seconds: number; nanoseconds: number };
}

interface Document {
  id: string;
  title: string;
  propertyId: string;
  expiryDate: Timestamp | Date | { seconds: number; nanoseconds: number };
}

interface RentPayment {
  id: string;
  propertyId: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending';
  year: number;
  month: string;
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

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Pending':
    case 'Scheduled':
    case 'Expiring Soon':
      return 'secondary';
    case 'Due':
    case 'Expired':
    case 'Unpaid':
        return 'destructive';
    default:
      return 'outline';
  }
};

const formatAddress = (address: Property['address']) => {
    if (!address) return 'Unknown Property';
    return `${address.street}, ${address.city}`;
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Primary Properties Listener
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid), where('status', '!=', 'Deleted'));
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  // States for aggregated data
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allRentPayments, setAllRentPayments] = useState<RentPayment[]>([]);
  const [isAggregating, setIsAggregating] = useState(false);

  // Aggregation Effect: Fetch sub-collections for each property in parallel
  useEffect(() => {
    if (!user || !properties || properties.length === 0) {
        setMaintenanceLogs([]);
        setInspections([]);
        setDocuments([]);
        setAllRentPayments([]);
        return;
    }

    const aggregateData = async () => {
        setIsAggregating(true);
        try {
            const maintPromises: Promise<any>[] = [];
            const inspPromises: Promise<any>[] = [];
            const docPromises: Promise<any>[] = [];
            const rentPromises: Promise<any>[] = [];

            properties.forEach(prop => {
                const ownerFilter = where('ownerId', '==', user.uid);
                maintPromises.push(getDocs(query(collection(firestore, 'properties', prop.id, 'maintenanceLogs'), ownerFilter)));
                inspPromises.push(getDocs(query(collection(firestore, 'properties', prop.id, 'inspections'), ownerFilter)));
                docPromises.push(getDocs(query(collection(firestore, 'properties', prop.id, 'documents'), ownerFilter)));
                rentPromises.push(getDocs(query(collection(firestore, 'properties', prop.id, 'rentPayments'), ownerFilter)));
            });

            const [maintSnaps, inspSnaps, docSnaps, rentSnaps] = await Promise.all([
                Promise.all(maintPromises),
                Promise.all(inspPromises),
                Promise.all(docPromises),
                Promise.all(rentPromises)
            ]);

            setMaintenanceLogs(maintSnaps.flatMap(snap => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MaintenanceLog))));
            setInspections(inspSnaps.flatMap(snap => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Inspection))));
            setDocuments(docSnaps.flatMap(snap => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Document))));
            setAllRentPayments(rentSnaps.flatMap(snap => snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as RentPayment))));
        } catch (err) {
            console.error("Aggregation failed:", err);
        } finally {
            setIsAggregating(false);
        }
    };

    aggregateData();
  }, [user, properties, firestore]);

  const isLoading = isLoadingProperties || isAggregating;

  // --- Processed Data ---

  const propertyMap = useMemo(() => 
    properties?.reduce((map, prop) => {
      map[prop.id] = prop.address;
      return map;
    }, {} as Record<string, Property['address']>) ?? {}
  , [properties]);

  const activeProperties = useMemo(() => properties?.filter(p => ['Vacant', 'Occupied', 'Under Maintenance'].includes(p.status)) ?? [], [properties]);
  const openMaintenanceCount = useMemo(() => maintenanceLogs.filter(log => log.status === 'Open').length, [maintenanceLogs]);
  
  const upcomingInspectionsCount = useMemo(() => inspections.filter(insp => {
      const scheduledDate = toDate(insp.scheduledDate);
      if (!scheduledDate) return false;
      return insp.status === 'Scheduled' && isFuture(scheduledDate);
  }).length, [inspections]);

  const recentActivities = useMemo(() => 
    maintenanceLogs
        .sort((a, b) => {
            const dateA = toDate(a.reportedDate) || new Date(0);
            const dateB = toDate(b.reportedDate) || new Date(0);
            return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 4)
        .map(log => {
            const date = toDate(log.reportedDate) || new Date();
            return {
                id: log.id,
                property: propertyMap[log.propertyId] ? formatAddress(propertyMap[log.propertyId]) : 'Portfolio Wide',
                activity: log.title,
                date: format(date, 'dd/MM/yyyy'),
                href: `/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`
            };
        })
  , [maintenanceLogs, propertyMap]);

  const upcomingTasks = useMemo(() => {
    const inspectionTasks = inspections
        .map(insp => {
            const date = toDate(insp.scheduledDate);
            if (!date || insp.status !== 'Scheduled' || !isFuture(date)) return null;
            return {
                id: `insp-${insp.id}`,
                task: insp.type || 'Inspection',
                property: propertyMap[insp.propertyId] ? formatAddress(propertyMap[insp.propertyId]) : 'Portfolio Wide',
                status: 'Scheduled',
                dueDate: date,
                href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}`
            };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);
    
    const documentTasks = documents
        .map(doc => {
            const expiry = toDate(doc.expiryDate);
            if (!expiry) return null;
            const status = getDocumentStatus(expiry);
            if (status === 'Valid') return null;
            return {
                id: `doc-${doc.id}`,
                task: doc.title,
                property: propertyMap[doc.propertyId] ? formatAddress(propertyMap[doc.propertyId]) : 'Portfolio Wide',
                status: status,
                dueDate: expiry,
                href: '/dashboard/documents'
            };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

        return [...inspectionTasks, ...documentTasks]
            .sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime())
            .slice(0, 4)
            .map(t => ({
                ...t,
                dueDate: format(t.dueDate, 'dd/MM/yyyy')
            }));
  }, [inspections, documents, propertyMap]);
  
  const currentYear = new Date().getFullYear();
  const currentMonth = format(new Date(), 'MMMM');

  const rentStatusData = useMemo(() => {
    if (isLoading || !properties) return [];
    const occupiedPropertiesCount = properties.filter(p => p.status === 'Occupied').length;
    
    const monthlyPayments = allRentPayments.filter(p => p.year === currentYear && p.month === currentMonth);
    
    const statusCounts: Record<'Paid' | 'Partially Paid' | 'Unpaid', number> = { 'Paid': 0, 'Partially Paid': 0, 'Unpaid': 0 };
    monthlyPayments.forEach(payment => { if (statusCounts[payment.status] !== undefined) statusCounts[payment.status]++; });
    
    const nonPendingCount = statusCounts.Paid + statusCounts['Partially Paid'] + statusCounts.Unpaid;
    const pendingCount = Math.max(0, occupiedPropertiesCount - nonPendingCount);
    
    return [
      { status: 'Paid', count: statusCounts.Paid, fill: 'hsl(var(--chart-2))' },
      { status: 'Partially Paid', count: statusCounts['Partially Paid'], fill: 'hsl(var(--chart-4))' },
      { status: 'Unpaid', count: statusCounts.Unpaid, fill: 'hsl(var(--chart-1))' },
      { status: 'Pending', count: pendingCount, fill: 'hsl(var(--muted))' },
    ].filter(item => item.count > 0);
  }, [isLoading, properties, allRentPayments, currentYear, currentMonth]);

  const rentChartConfig = {
      count: { label: "Properties" },
      Paid: { label: "Paid", color: "hsl(var(--chart-2))" },
      "Partially Paid": { label: "Partially Paid", color: "hsl(var(--chart-4))" },
      Unpaid: { label: "Unpaid", color: "hsl(var(--chart-1))" },
      Pending: { label: "Pending", color: "hsl(var(--muted))" },
  } satisfies ChartConfig;

  const infoCards = [
    { title: 'Total Properties', value: isLoading ? '-' : activeProperties.length, icon: Home, description: 'Active properties' },
    { title: 'Open Maintenance', value: isLoading ? '-' : openMaintenanceCount, icon: Wrench, description: 'Issues needing attention' },
    { title: 'Upcoming Inspections', value: isLoading ? '-' : upcomingInspectionsCount, icon: CalendarCheck, description: 'Scheduled tasks' },
    { title: 'Total Documents', value: isLoading ? '-' : documents.length, icon: Files, description: 'Compliance records' },
  ];

  if (!isLoading && properties?.length === 0) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto py-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold font-headline text-primary">Welcome to RentSafeUK!</h1>
          <p className="text-muted-foreground text-lg">Let's get your rental portfolio set up for high performance.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="relative overflow-hidden border-primary/20 shadow-lg">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Home className="h-24 w-24" /></div>
            <CardHeader>
              <Badge className="w-fit mb-2">Step 1</Badge>
              <CardTitle>Add Property</CardTitle>
              <CardDescription>Enter address and basic details.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="w-full">
                <Link href="/dashboard/properties/add">Add Property <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardFooter>
          </Card>
          <Card className="opacity-50 grayscale">
            <CardHeader>
              <Badge variant="outline" className="w-fit mb-2">Step 2</Badge>
              <CardTitle>Assign Tenant</CardTitle>
              <CardDescription>Link a tenant to manage rent.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button disabled className="w-full">Assign Tenant</Button>
            </CardFooter>
          </Card>
          <Card className="opacity-50 grayscale">
            <CardHeader>
              <Badge variant="outline" className="w-fit mb-2">Step 3</Badge>
              <CardTitle>Compliance</CardTitle>
              <CardDescription>Upload Gas Safety and EICR records.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button disabled className="w-full">Upload Documents</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {infoCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PoundSterling className="h-5 w-5" /> Rent Status</CardTitle>
                <CardDescription>{currentMonth} {currentYear}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : rentStatusData.length > 0 ? (
                    <ChartContainer config={rentChartConfig} className="mx-auto aspect-square max-h-[250px]">
                        <PieChart>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="count" hideLabel />} />
                            <Pie data={rentStatusData} dataKey="count" nameKey="status" innerRadius={60} strokeWidth={5}>
                                {rentStatusData.map((entry) => <Cell key={`cell-${entry.status}`} fill={entry.fill} className="stroke-background"/>)}
                            </Pie>
                            <ChartLegend content={<ChartLegendContent nameKey="status" />} className="-mt-4" />
                        </PieChart>
                    </ChartContainer>
                ) : (
                    <div className="text-center text-muted-foreground py-10 text-sm italic">No occupied properties tracked this month.</div>
                )}
            </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent Activity</CardTitle>
                <CardDescription>Latest maintenance reports across your portfolio.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild><Link href="/dashboard/maintenance/logged">View All</Link></Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : recentActivities.length > 0 ? (
                <div className="space-y-4">
                    {recentActivities.map((activity) => (
                        <Link href={activity.href} key={activity.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors">
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{activity.activity}</p>
                                <p className="text-xs text-muted-foreground truncate">{activity.property}</p>
                            </div>
                            <div className="text-right ml-4">
                                <p className="text-xs font-medium">{activity.date}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-10 italic text-sm">No maintenance activity logged yet.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListTodo className="h-5 w-5" /> Critical Tasks & Compliance</CardTitle>
          <CardDescription>Upcoming inspections and expiring legal documents.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
              <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
           ) : upcomingTasks.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                  {upcomingTasks.map((task) => (
                      <Link href={task.href} key={task.id} className="block group">
                          <Card className="hover:border-primary transition-colors">
                              <CardContent className="p-4 flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{task.task}</p>
                                      <p className="text-xs text-muted-foreground truncate">{task.property}</p>
                                  </div>
                                  <div className="text-right ml-4 shrink-0">
                                      <Badge variant={getStatusVariant(task.status)} className="mb-1">{task.status}</Badge>
                                      <p className="text-[10px] font-bold text-muted-foreground">DUE: {task.dueDate}</p>
                                  </div>
                              </CardContent>
                          </Card>
                      </Link>
                  ))}
              </div>
           ) : (
              <div className="text-center text-muted-foreground py-10 italic text-sm">You're all caught up! No upcoming tasks.</div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}