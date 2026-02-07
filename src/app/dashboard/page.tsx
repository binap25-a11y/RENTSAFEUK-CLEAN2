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
  PlusCircle,
  Activity,
  ListTodo,
  FileText,
  Loader2,
  PoundSterling,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, Timestamp, collectionGroup, orderBy, limit } from 'firebase/firestore';
import { useMemo } from 'react';
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
  reportedDate: Timestamp | Date;
}

interface Inspection {
  id: string;
  type: string;
  propertyId: string;
  status: string;
  scheduledDate: Timestamp | Date;
}

interface Document {
  id: string;
  title: string;
  propertyId: string;
  expiryDate: Timestamp | Date;
}

interface RentPayment {
  id: string;
  propertyId: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending';
  year: number;
  month: string;
}

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

  // --- Optimized Global Queries using Collection Groups ---
  
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'properties'), where('ownerId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'maintenanceLogs'), 
      where('ownerId', '==', user.uid),
      orderBy('reportedDate', 'desc'),
      limit(20)
    );
  }, [user, firestore]);
  const { data: maintenanceLogs, isLoading: isLoadingMaintenance, error: maintenanceError } = useCollection<MaintenanceLog>(maintenanceQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'inspections'), 
      where('ownerId', '==', user.uid),
      orderBy('scheduledDate', 'asc'),
      limit(20)
    );
  }, [user, firestore]);
  const { data: inspections, isLoading: isLoadingInspections, error: inspectionError } = useCollection<Inspection>(inspectionsQuery);

  const documentsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'documents'), 
      where('ownerId', '==', user.uid),
      orderBy('expiryDate', 'asc'),
      limit(50)
    );
  }, [user, firestore]);
  const { data: documents, isLoading: isLoadingDocuments, error: documentError } = useCollection<Document>(documentsQuery);

  const currentYear = new Date().getFullYear();
  const currentMonth = format(new Date(), 'MMMM');
  const rentQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collectionGroup(firestore, 'rentPayments'), 
      where('ownerId', '==', user.uid),
      where('year', '==', currentYear),
      where('month', '==', currentMonth)
    );
  }, [user, firestore, currentYear, currentMonth]);
  const { data: rentPayments, isLoading: isLoadingRent, error: rentError } = useCollection<RentPayment>(rentQuery);

  const isLoading = isLoadingProperties || isLoadingMaintenance || isLoadingInspections || isLoadingDocuments || isLoadingRent;
  const globalError = maintenanceError || inspectionError || documentError || rentError;

  // --- Processed Data ---

  const propertyMap = useMemo(() => 
    properties?.reduce((map, prop) => {
      map[prop.id] = prop.address;
      return map;
    }, {} as Record<string, Property['address']>) ?? {}
  , [properties]);

  const activeProperties = useMemo(() => properties?.filter(p => ['Vacant', 'Occupied', 'Under Maintenance'].includes(p.status)) ?? [], [properties]);
  const openMaintenanceCount = useMemo(() => maintenanceLogs?.filter(log => log.status === 'Open').length ?? 0, [maintenanceLogs]);
  
  const upcomingInspectionsCount = useMemo(() => inspections?.filter(insp => {
      if (!insp.scheduledDate) return false;
      const scheduledDate = insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate();
      return insp.status === 'Scheduled' && isFuture(scheduledDate);
  }).length ?? 0, [inspections]);

  const recentActivities = useMemo(() => 
    maintenanceLogs
        ?.slice(0, 4)
        .map(log => ({
            id: log.id,
            property: propertyMap[log.propertyId] ? formatAddress(propertyMap[log.propertyId]) : 'Portfolio Wide',
            activity: log.title,
            date: format((log.reportedDate as Timestamp).toDate(), 'dd/MM/yyyy'),
            href: `/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`
        })) ?? []
  , [maintenanceLogs, propertyMap]);

  const upcomingTasks = useMemo(() => {
    const inspectionTasks = inspections
        ?.filter(insp => {
            if (!insp.scheduledDate) return false;
            const scheduledDate = insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate();
            return insp.status === 'Scheduled' && isFuture(scheduledDate)
        })
        .map(insp => ({
            id: `insp-${insp.id}`,
            task: insp.type || 'Inspection',
            property: propertyMap[insp.propertyId] ? formatAddress(propertyMap[insp.propertyId]) : 'Portfolio Wide',
            status: 'Scheduled',
            dueDate: format((insp.scheduledDate as Timestamp).toDate(), 'dd/MM/yyyy'),
            href: `/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}`
        })) ?? [];
    
    const documentTasks = documents
        ?.map(doc => {
            if (!doc.expiryDate) return null;
            const expiry = doc.expiryDate instanceof Date ? doc.expiryDate : (doc.expiryDate as Timestamp).toDate();
            return { ...doc, status: getDocumentStatus(expiry), expiryDate: expiry };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null && (doc.status === 'Expired' || doc.status === 'Expiring Soon'))
        .map(doc => ({
            id: `doc-${doc.id}`,
            task: doc.title,
            property: propertyMap[doc.propertyId] ? formatAddress(propertyMap[doc.propertyId]) : 'Portfolio Wide',
            status: doc.status,
            dueDate: format(doc.expiryDate, 'dd/MM/yyyy'),
            href: '/dashboard/documents'
        })) ?? [];

        return [...inspectionTasks, ...documentTasks]
            .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .slice(0, 4);
  }, [inspections, documents, propertyMap]);
  
  const rentStatusData = useMemo(() => {
    if (isLoading || !properties) return [];
    const occupiedPropertiesCount = properties.filter(p => p.status === 'Occupied').length;
    const statusCounts: Record<'Paid' | 'Partially Paid' | 'Unpaid', number> = { 'Paid': 0, 'Partially Paid': 0, 'Unpaid': 0 };
    rentPayments?.forEach(payment => { if (statusCounts[payment.status] !== undefined) statusCounts[payment.status]++; });
    const nonPendingCount = statusCounts.Paid + statusCounts['Partially Paid'] + statusCounts.Unpaid;
    const pendingCount = Math.max(0, occupiedPropertiesCount - nonPendingCount);
    return [
      { status: 'Paid', count: statusCounts.Paid, fill: 'hsl(var(--chart-2))' },
      { status: 'Partially Paid', count: statusCounts['Partially Paid'], fill: 'hsl(var(--chart-4))' },
      { status: 'Unpaid', count: statusCounts.Unpaid, fill: 'hsl(var(--chart-1))' },
      { status: 'Pending', count: pendingCount, fill: 'hsl(var(--muted))' },
    ].filter(item => item.count > 0);
  }, [isLoading, properties, rentPayments]);

  const rentChartConfig = {
      count: { label: "Properties" },
      Paid: { label: "Paid", color: "hsl(var(--chart-2))" },
      "Partially Paid": { label: "Partially Paid", color: "hsl(var(--chart-4))" },
      Unpaid: { label: "Unpaid", color: "hsl(var(--chart-1))" },
      Pending: { label: "Pending", color: "hsl(var(--muted))" },
  } satisfies ChartConfig;

  if (globalError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Portfolio Analytics Status</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          To display your global maintenance and inspection reports, Firestore requires a composite performance index. Please check the Firebase Console logs for a link to click, or wait a few minutes if you've recently initialized the app.
        </p>
        <Button onClick={() => window.location.reload()}>Refresh Dashboard</Button>
      </div>
    );
  }

  const infoCards = [
    { title: 'Total Properties', value: isLoading ? '-' : activeProperties.length, icon: Home, description: 'Active properties' },
    { title: 'Open Maintenance', value: isLoading ? '-' : openMaintenanceCount, icon: Wrench, description: 'Issues needing attention' },
    { title: 'Upcoming Inspections', value: isLoading ? '-' : upcomingInspectionsCount, icon: CalendarCheck, description: 'Scheduled tasks' },
    { title: 'Total Documents', value: isLoading ? '-' : documents?.length ?? 0, icon: Files, description: 'Compliance records' },
  ];

  if (!isLoading && activeProperties.length === 0) {
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