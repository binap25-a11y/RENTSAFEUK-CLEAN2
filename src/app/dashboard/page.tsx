'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  PoundSterling
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
import { collection, query, where, Timestamp, getDocs, collectionGroup } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
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
  address: string;
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


// Helper for document status
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


export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [rentPayments, setRentPayments] = useState<RentPayment[]>([]);
  const [isSubcollectionsLoading, setIsSubcollectionsLoading] = useState(true);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);
  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  useEffect(() => {
    if (!firestore || !user || isLoadingProperties) return;

    const fetchAllData = async () => {
        setIsSubcollectionsLoading(true);

        const maintenanceQuery = query(collectionGroup(firestore, 'maintenanceLogs'), where('ownerId', '==', user.uid));
        const inspectionQuery = query(collectionGroup(firestore, 'inspections'), where('ownerId', '==', user.uid));
        const documentQuery = query(collectionGroup(firestore, 'documents'), where('ownerId', '==', user.uid));
        
        const currentMonth = format(new Date(), 'MMMM');
        const currentYear = new Date().getFullYear();
        const rentQuery = query(
            collectionGroup(firestore, 'rentPayments'), 
            where('ownerId', '==', user.uid),
            where('year', '==', currentYear),
            where('month', '==', currentMonth)
        );

        try {
            const [maintenanceSnap, inspectionSnap, documentSnap, rentSnap] = await Promise.all([
                getDocs(maintenanceQuery),
                getDocs(inspectionQuery),
                getDocs(documentQuery),
                getDocs(rentQuery),
            ]);

            const allLogs = maintenanceSnap.docs.map(doc => ({
                id: doc.id,
                propertyId: doc.ref.parent.parent!.id,
                ...doc.data()
            } as MaintenanceLog));

            const allInspections = inspectionSnap.docs.map(doc => ({
                id: doc.id,
                propertyId: doc.ref.parent.parent!.id,
                ...doc.data()
            } as Inspection));

            const allDocs = documentSnap.docs.map(doc => ({
                id: doc.id,
                propertyId: doc.ref.parent.parent!.id,
                ...doc.data()
            } as Document));

            const allRents = rentSnap.docs.map(doc => ({
                id: doc.id,
                propertyId: doc.ref.parent.parent!.id,
                ...doc.data()
            } as RentPayment));

            setMaintenanceLogs(allLogs);
            setInspections(allInspections);
            setDocuments(allDocs);
            setRentPayments(allRents);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setIsSubcollectionsLoading(false);
        }
    };
    
    fetchAllData();

  }, [firestore, user, isLoadingProperties]);


  const isLoading = isLoadingProperties || isSubcollectionsLoading;
  
  const propertyMap = useMemo(() => 
    properties?.reduce((map, prop) => {
      map[prop.id] = prop.address;
      return map;
    }, {} as Record<string, string>) ?? {}
  , [properties]);

  const activeProperties = useMemo(() => properties?.filter(p => p.status !== 'Deleted') ?? [], [properties]);
  const openMaintenanceCount = useMemo(() => maintenanceLogs?.filter(log => log.status === 'Open').length ?? 0, [maintenanceLogs]);
  const upcomingInspectionsCount = useMemo(() => inspections?.filter(insp => {
      if (!insp.scheduledDate) return false;
      const scheduledDate = insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate();
      return insp.status === 'Scheduled' && isFuture(scheduledDate);
  }).length ?? 0, [inspections]);
  const totalDocumentsCount = useMemo(() => documents?.length ?? 0, [documents]);

  const recentActivities = useMemo(() => 
    maintenanceLogs
        ?.sort((a,b) => ((b.reportedDate as Timestamp)?.toMillis?.() ?? 0) - ((a.reportedDate as Timestamp)?.toMillis?.() ?? 0))
        .slice(0, 4)
        .map(log => ({
            id: log.id,
            property: propertyMap[log.propertyId] || 'Unknown Property',
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
            property: propertyMap[insp.propertyId] || 'Unknown Property',
            status: 'Scheduled',
            dueDate: format((insp.scheduledDate as Timestamp).toDate(), 'dd/MM/yyyy'),
            href: `/dashboard/properties/${insp.propertyId}/inspections/${insp.id}`
        })) ?? [];
    
    const documentTasks = documents
        ?.map(doc => {
            if (!doc.expiryDate) return null;
            const expiry = doc.expiryDate instanceof Date ? doc.expiryDate : (doc.expiryDate as Timestamp).toDate();
            return {
                ...doc,
                status: getDocumentStatus(expiry),
                expiryDate: expiry
            };
        })
        .filter((doc): doc is NonNullable<typeof doc> => doc !== null && (doc.status === 'Expired' || doc.status === 'Expiring Soon'))
        .map(doc => ({
            id: `doc-${doc.id}`,
            task: doc.title,
            property: propertyMap[doc.propertyId] || 'Unknown Property',
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
    
    const statusCounts: Record<'Paid' | 'Partially Paid' | 'Unpaid', number> = {
      'Paid': 0,
      'Partially Paid': 0,
      'Unpaid': 0,
    };

    rentPayments.forEach(payment => {
      if (statusCounts[payment.status] !== undefined) {
        statusCounts[payment.status]++;
      }
    });

    const nonPendingCount = statusCounts.Paid + statusCounts['Partially Paid'] + statusCounts.Unpaid;
    const pendingCount = occupiedPropertiesCount - nonPendingCount;

    const data = [
      { status: 'Paid', count: statusCounts.Paid, fill: 'hsl(var(--chart-2))' },
      { status: 'Partially Paid', count: statusCounts['Partially Paid'], fill: 'hsl(var(--chart-4))' },
      { status: 'Unpaid', count: statusCounts.Unpaid, fill: 'hsl(var(--chart-1))' },
      { status: 'Pending', count: pendingCount > 0 ? pendingCount : 0, fill: 'hsl(var(--muted))' },
    ].filter(item => item.count > 0);

    return data;

  }, [isLoading, properties, rentPayments]);

  const rentChartConfig = {
      count: {
        label: "Properties",
      },
      Paid: {
        label: "Paid",
        color: "hsl(var(--chart-2))",
      },
      "Partially Paid": {
        label: "Partially Paid",
        color: "hsl(var(--chart-4))",
      },
      Unpaid: {
        label: "Unpaid",
        color: "hsl(var(--chart-1))",
      },
      Pending: {
        label: "Pending",
        color: "hsl(var(--muted))",
      },
  } satisfies ChartConfig;


  const infoCards = [
    {
      title: 'Total Properties',
      value: isLoading ? '-' : activeProperties.length,
      icon: Home,
      description: 'Active properties in your portfolio',
    },
    {
      title: 'Open Maintenance',
      value: isLoading ? '-' : openMaintenanceCount,
      icon: Wrench,
      description: 'Issues needing attention',
    },
    {
      title: 'Upcoming Inspections',
      value: isLoading ? '-' : upcomingInspectionsCount,
      icon: CalendarCheck,
      description: 'Scheduled inspections',
    },
    {
      title: 'Total Documents',
      value: isLoading ? '-' : totalDocumentsCount,
      icon: Files,
      description: 'Certificates, agreements, etc.',
    },
  ];

  const actionCards = [
    {
      title: 'Add Property',
      href: '/dashboard/properties/add',
      icon: PlusCircle,
      description: 'Onboard a new rental property.',
    },
    {
      title: 'Log Maintenance',
      href: '/dashboard/maintenance',
      icon: Wrench,
      description: 'Report a new maintenance issue.',
    },
    {
      title: 'Schedule Inspection',
      href: '/dashboard/inspections',
      icon: CalendarCheck,
      description: 'Book a new property inspection.',
    },
    {
      title: 'Upload Document',
      href: '/dashboard/documents/upload',
      icon: FileText,
      description: 'Add agreements or certificates.',
    },
  ];

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
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {actionCards.map((action) => (
          <Card
            key={action.title}
            className="group hover:bg-accent/50 transition-colors"
          >
            <Link href={action.href} className="block h-full">
              <CardHeader>
                <action.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{action.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{action.description}</CardDescription>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <PoundSterling className="h-5 w-5" /> Monthly Rent Overview
            </CardTitle>
            <CardDescription>
                Rent payment status for {format(new Date(), 'MMMM yyyy')}.
            </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : rentStatusData.length > 0 ? (
                <ChartContainer config={rentChartConfig} className="mx-auto aspect-square max-h-[300px]">
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent nameKey="count" hideLabel />}
                        />
                        <Pie
                            data={rentStatusData}
                            dataKey="count"
                            nameKey="status"
                            innerRadius={60}
                            strokeWidth={5}
                            labelLine={false}
                            label={({
                              payload,
                              ...props
                            }) => {
                              return (
                                <text
                                  cx={props.cx}
                                  cy={props.cy}
                                  x={props.x}
                                  y={props.y}
                                  textAnchor={props.textAnchor}
                                  dominantBaseline={props.dominantBaseline}
                                  fill="hsla(var(--foreground))"
                                  className='text-sm'
                                >
                                  {`${payload.status} (${payload.value})`}
                                </text>
                              )
                            }}
                        >
                            {rentStatusData.map((entry) => (
                                <Cell key={`cell-${entry.status}`} fill={entry.fill} className="stroke-background"/>
                            ))}
                        </Pie>
                        <ChartLegend
                            content={<ChartLegendContent nameKey="status" />}
                            className="-mt-4"
                        />
                    </PieChart>
                </ChartContainer>
            ) : (
                <div className="text-center text-muted-foreground py-10">No occupied properties to track rent for.</div>
            )}
        </CardContent>
      </Card>


      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> Recent Activity
            </CardTitle>
            <CardDescription>
              A log of the latest maintenance issues reported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : recentActivities.length > 0 ? (
                <>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Property</TableHead>
                                <TableHead>Activity</TableHead>
                                <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentActivities.map((activity) => (
                                <TableRow key={activity.id}>
                                    <TableCell className="font-medium">
                                    {activity.property}
                                    </TableCell>
                                    <TableCell>
                                      <Link href={activity.href} className="hover:underline">
                                        {activity.activity}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="text-right">{activity.date}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="space-y-4 md:hidden">
                        {recentActivities.map((activity) => (
                            <Link href={activity.href} key={activity.id} className="block rounded-lg border bg-card text-card-foreground p-4 hover:bg-accent">
                                <p className="font-medium">{activity.activity}</p>
                                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                                    <span>{activity.property}</span>
                                    <span>{activity.date}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            ) : (
                <div className="text-center text-muted-foreground py-10">No recent activity.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" /> Upcoming Tasks & Reminders
            </CardTitle>
            <CardDescription>
              Inspections and compliance documents that are due soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
             ) : upcomingTasks.length > 0 ? (
                <>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Task</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Due Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {upcomingTasks.map((task) => (
                                <TableRow key={task.id}>
                                    <TableCell>
                                      <Link href={task.href} className="hover:underline">
                                        <div className="font-medium">{task.task}</div>
                                        <div className="text-sm text-muted-foreground">
                                            {task.property}
                                        </div>
                                      </Link>
                                    </TableCell>
                                    <TableCell>
                                    <Badge variant={getStatusVariant(task.status)}>
                                        {task.status}
                                    </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{task.dueDate}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-4 md:hidden">
                        {upcomingTasks.map((task) => (
                            <Link href={task.href} key={task.id} className="block rounded-lg border bg-card text-card-foreground p-4 hover:bg-accent">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <p className="font-medium">{task.task}</p>
                                        <p className="text-sm text-muted-foreground">{task.property}</p>
                                    </div>
                                    <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">Due: {task.dueDate}</p>
                            </Link>
                        ))}
                    </div>
                </>
             ) : (
                <div className="text-center text-muted-foreground py-10">No upcoming tasks.</div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
