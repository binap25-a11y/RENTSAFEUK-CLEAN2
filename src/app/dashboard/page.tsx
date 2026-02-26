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
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
  PlusCircle,
  ArrowUpRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
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
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

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
  priority: string;
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

const formatAddress = (address: Property['address']) => {
    if (!address) return 'Unknown Property';
    return `${address.street}, ${address.city}`;
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  // Primary Properties Listener - strictly hierarchical
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'properties'), 
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);
  const { data: allProperties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);

  // States for aggregated data
  const [maintenanceMap, setMaintenanceMap] = useState<Record<string, MaintenanceLog[]>>({});
  const [inspectionsMap, setInspectionsMap] = useState<Record<string, Inspection[]>>({});
  const [documentsMap, setDocumentsMap] = useState<Record<string, Document[]>>({});
  const [rentPaymentsMap, setRentPaymentsMap] = useState<Record<string, RentPayment[]>>({});
  
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState<string | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    setCurrentMonth(format(new Date(), 'MMMM'));
  }, []);

  // Define properties that are truly "Active"
  const properties = useMemo(() => {
    const activeStatuses = ['Vacant', 'Occupied', 'Under Maintenance'];
    return allProperties?.filter(p => activeStatuses.includes(p.status || '')) ?? [];
  }, [allProperties]);

  const propertyIdsKey = useMemo(() => properties.map(p => p.id).join(','), [properties]);

  // STABLE REAL-TIME AGGREGATION
  useEffect(() => {
    if (!user || !firestore || properties.length === 0) {
        setMaintenanceMap({});
        setInspectionsMap({});
        setDocumentsMap({});
        setRentPaymentsMap({});
        return;
    }

    const unsubs: (() => void)[] = [];

    properties.forEach(prop => {
        const ownerFilter = where('ownerId', '==', user.uid);
        
        // Maintenance Logs
        unsubs.push(onSnapshot(query(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'maintenanceLogs'), ownerFilter), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog));
            setMaintenanceMap(prev => ({ ...prev, [prop.id]: data }));
        }));

        // Inspections
        unsubs.push(onSnapshot(query(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'inspections'), ownerFilter), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Inspection));
            setInspectionsMap(prev => ({ ...prev, [prop.id]: data }));
        }));

        // Documents
        unsubs.push(onSnapshot(query(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'documents'), ownerFilter), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Document));
            setDocumentsMap(prev => ({ ...prev, [prop.id]: data }));
        }));

        // Rent Payments
        unsubs.push(onSnapshot(query(collection(firestore, 'userProfiles', user.uid, 'properties', prop.id, 'rentPayments'), ownerFilter), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as RentPayment));
            setRentPaymentsMap(prev => ({ ...prev, [prop.id]: data }));
        }));
    });

    return () => unsubs.forEach(u => u());
  }, [user, propertyIdsKey, firestore, properties.length]);

  // Combined data for calculations
  const maintenanceLogs = useMemo(() => Object.values(maintenanceMap).flat(), [maintenanceMap]);
  const inspections = useMemo(() => Object.values(inspectionsMap).flat(), [inspectionsMap]);
  const documents = useMemo(() => Object.values(documentsMap).flat(), [documentsMap]);
  const allRentPayments = useMemo(() => Object.values(rentPaymentsMap).flat(), [rentPaymentsMap]);

  const isLoading = isLoadingProperties || !currentYear;

  const propertyMap = useMemo(() => 
    properties?.reduce((map, prop) => {
      map[prop.id] = prop.address;
      return map;
    }, {} as Record<string, Property['address']>) ?? {}
  , [properties]);

  const activePropertiesCount = properties.length;
  
  const openMaintenance = useMemo(() => 
    maintenanceLogs.filter(log => log.status === 'Open' || log.status === 'In Progress'), 
  [maintenanceLogs]);
  
  const upcomingInspections = useMemo(() => inspections.filter(insp => {
      const scheduledDate = toDate(insp.scheduledDate);
      if (!scheduledDate) return false;
      return insp.status === 'Scheduled' && isFuture(scheduledDate);
  }).sort((a,b) => (toDate(a.scheduledDate)?.getTime() || 0) - (toDate(b.scheduledDate)?.getTime() || 0)), [inspections]);

  const recentActivities = useMemo(() => 
    maintenanceLogs
        .sort((a, b) => {
            const dateA = toDate(a.reportedDate) || new Date(0);
            const dateB = toDate(b.reportedDate) || new Date(0);
            return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 5)
        .map(log => {
            const date = toDate(log.reportedDate) || new Date();
            return {
                id: log.id,
                property: propertyMap[log.propertyId] ? formatAddress(propertyMap[log.propertyId]) : 'Portfolio Wide',
                activity: log.title,
                status: log.status,
                priority: log.priority,
                date: format(date, 'dd MMM'),
                href: `/dashboard/maintenance/${log.id}?propertyId=${log.propertyId}`
            };
        })
  , [maintenanceLogs, propertyMap]);

  const criticalCompliance = useMemo(() => {
    const expiringDocs = documents
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
              type: 'Document',
              href: '/dashboard/documents'
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

        return expiringDocs
            .sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime())
            .slice(0, 5);
  }, [documents, propertyMap]);
  
  const rentStatusData = useMemo(() => {
    if (isLoading || !properties || !currentYear || !currentMonth) return [];
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

  if (!isLoading && allProperties?.length === 0) {
    return (
      <div className="flex flex-col gap-8 max-w-4xl mx-auto py-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold font-headline text-primary">Welcome to RentSafeUK</h1>
          <p className="text-muted-foreground text-lg">Let's get your rental portfolio set up for high performance.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="relative overflow-hidden border-primary/20 shadow-lg cursor-pointer group">
            <Link href="/dashboard/properties/add" className="absolute inset-0 z-10" />
            <div className="absolute top-0 right-0 p-4 opacity-10"><Home className="h-24 w-24" /></div>
            <CardHeader>
              <Badge className="w-fit mb-2">Step 1</Badge>
              <CardTitle>Add Property</CardTitle>
              <CardDescription>Enter address and basic details.</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild className="w-full relative z-20">
                <span>Add Property <ArrowRight className="ml-2 h-4 w-4" /></span>
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
    <div className="flex flex-col gap-8 p-2 md:p-0">
      {/* Header Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md overflow-hidden group">
          <div className="h-1 bg-primary w-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">My Properties</CardTitle>
            <Home className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : activePropertiesCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
                Active in Portfolio <ArrowUpRight className="h-2 w-2" />
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md overflow-hidden group">
          <div className="h-1 bg-destructive w-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : openMaintenance.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
                Issues Requiring Action <ArrowUpRight className="h-2 w-2" />
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md overflow-hidden group">
          <div className="h-1 bg-amber-500 w-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Inspections</CardTitle>
            <CalendarCheck className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : upcomingInspections.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
                Scheduled Field Checks <ArrowUpRight className="h-2 w-2" />
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md overflow-hidden group">
          <div className="h-1 bg-green-500 w-full" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Compliance</CardTitle>
            <Files className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : documents.length}</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
                Verified Certificates <ArrowUpRight className="h-2 w-2" />
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Rent Tracker & Statistics */}
        <Card className="lg:col-span-4 shadow-lg border-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-bold font-headline">
                <PoundSterling className="h-5 w-5 text-primary" /> 
                Rent Tracker
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-muted/50 border-none">
                {currentMonth} {currentYear}
              </Badge>
            </div>
            <CardDescription className="text-xs">Monthly collection progress per unit.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 flex flex-col items-center">
            {isLoading ? (
              <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : rentStatusData.length > 0 ? (
              <>
                <ChartContainer config={rentChartConfig} className="w-full aspect-square max-h-[220px]">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="count" hideLabel />} />
                    <Pie data={rentStatusData} dataKey="count" nameKey="status" innerRadius={65} strokeWidth={5}>
                      {rentStatusData.map((entry) => <Cell key={`cell-${entry.status}`} fill={entry.fill} className="stroke-background outline-none"/>)}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="status" />} className="-mt-4 text-[10px] font-bold uppercase" />
                  </PieChart>
                </ChartContainer>
                <Button asChild variant="outline" size="sm" className="mt-6 w-full h-10 font-bold text-xs uppercase tracking-widest group bg-muted/20 border-none hover:bg-muted/40">
                  <Link href="/dashboard/expenses">
                    Detailed Rent Ledger <ChevronRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-16 text-sm italic bg-muted/20 rounded-xl border border-dashed w-full">
                No occupied units to track.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Feed (Recent Activity) */}
        <Card className="lg:col-span-8 shadow-lg border-none">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold font-headline">
                <Activity className="h-5 w-5 text-primary" /> 
                Active Activity Feed
              </CardTitle>
              <CardDescription className="text-xs">Latest maintenance and system events across the portfolio.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary/5">
              <Link href="/dashboard/maintenance/logged">See All <ChevronRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="px-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <Link href={activity.href} key={activity.id} className="block group">
                    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-all border border-transparent hover:border-border">
                        <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                        activity.priority === 'Emergency' ? 'border-destructive text-destructive shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-primary/20 text-primary'
                        )}>
                        <Wrench className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                            <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">{activity.activity}</p>
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">{activity.date}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate font-medium uppercase tracking-tighter opacity-70">{activity.property}</p>
                        </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-24 italic text-sm bg-muted/10 rounded-2xl border border-dashed flex flex-col items-center gap-3 m-2">
                <Activity className="h-10 w-10 opacity-10" />
                <p>System is currently idle. No recent events logged.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Critical Compliance Overviews */}
        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-destructive/5 border-b border-destructive/10 pb-4">
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-destructive font-headline">
                    <AlertCircle className="h-5 w-5" /> 
                    Critical Compliance
                    </CardTitle>
                    <CardDescription className="text-[11px] text-destructive/70 uppercase font-bold tracking-tighter">Immediate Attention Required</CardDescription>
                </div>
                <Badge variant="destructive" className="animate-pulse">Risk Alert</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-destructive" /></div>
            ) : criticalCompliance.length > 0 ? (
              <div className="space-y-3">
                {criticalCompliance.map((item) => (
                  <Link href={item.href} key={item.id} className="block group">
                    <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-transparent bg-muted/20 group-hover:border-destructive/20 transition-all">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{item.task}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-1">{item.property}</p>
                      </div>
                      <div className="text-right ml-4 shrink-0 flex flex-col items-end gap-1.5">
                        <Badge variant={item.status === 'Expired' ? 'destructive' : 'secondary'} className="h-5 text-[9px] font-bold uppercase">
                          {item.status}
                        </Badge>
                        <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" /> {format(item.dueDate, 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 italic text-sm bg-green-50/20 rounded-2xl border border-dashed border-green-200 flex flex-col items-center gap-3">
                <ShieldCheck className="h-12 w-12 text-green-500 opacity-30" />
                <p className="text-green-700 font-bold uppercase text-xs tracking-widest">All Compliance Items Valid</p>
              </div>
            )}
          </CardContent>
          {criticalCompliance.length > 0 && (
            <CardFooter className="bg-muted/5 border-t py-3">
              <Button asChild variant="link" className="text-xs font-bold text-primary w-full justify-center uppercase tracking-widest">
                <Link href="/dashboard/documents">Manage Audit Trail</Link>
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Upcoming Inspections & Tasks */}
        <Card className="border-none shadow-lg overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary font-headline">
              <ListTodo className="h-5 w-5" /> 
              Portfolio Tasks
            </CardTitle>
            <CardDescription className="text-[11px] text-primary/70 uppercase font-bold tracking-tighter">Scheduled Property Checks</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : upcomingInspections.length > 0 ? (
              <div className="space-y-3">
                {upcomingInspections.map((insp) => (
                  <Link href={`/dashboard/inspections/${insp.id}?propertyId=${insp.propertyId}`} key={insp.id} className="block group">
                    <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-transparent bg-muted/20 group-hover:border-primary/20 transition-all">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{insp.type}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-1">
                          {propertyMap[insp.propertyId] ? formatAddress(propertyMap[insp.propertyId]) : 'Property Check'}
                        </p>
                      </div>
                      <div className="text-right ml-4 shrink-0 flex flex-col items-end gap-1.5">
                        <Badge variant="secondary" className="h-5 text-[9px] font-bold uppercase bg-primary/10 text-primary border-none">Scheduled</Badge>
                        <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 tabular-nums">
                          <CalendarCheck className="h-3 w-3" /> {format(toDate(insp.scheduledDate)!, 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-muted/10 rounded-2xl border border-dashed flex flex-col items-center gap-4 m-2">
                <div className="bg-background p-4 rounded-full shadow-sm">
                  <PlusCircle className="h-8 w-8 text-primary opacity-20" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold">No Pending Inspections</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Maintain safety with regular checks.</p>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="text-[10px] font-bold h-8 border-none bg-muted/50"><Link href="/dashboard/inspections/single-let">New Single-Let</Link></Button>
                  <Button asChild size="sm" variant="outline" className="text-[10px] font-bold h-8 border-none bg-muted/50"><Link href="/dashboard/inspections/hmo">New HMO</Link></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
