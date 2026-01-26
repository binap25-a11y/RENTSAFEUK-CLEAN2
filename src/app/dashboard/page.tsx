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
  Loader2
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
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
import { format, isFuture, isBefore, addDays } from 'date-fns';

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
  const [isLoadingSubcollections, setIsLoadingSubcollections] = useState(true);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid)
    );
  }, [user, firestore]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  useEffect(() => {
    if (!properties || !firestore) {
      setIsLoadingSubcollections(false);
      return;
    }

    if (properties.length === 0) {
      setIsLoadingSubcollections(false);
      setMaintenanceLogs([]);
      setInspections([]);
      setDocuments([]);
      return;
    }

    const fetchSubcollections = async () => {
      setIsLoadingSubcollections(true);
      try {
        const maintenancePromises = properties.map(p => getDocs(collection(firestore, 'properties', p.id, 'maintenanceLogs')));
        const inspectionPromises = properties.map(p => getDocs(collection(firestore, 'properties', p.id, 'inspections')));
        const documentPromises = properties.map(p => getDocs(collection(firestore, 'properties', p.id, 'documents')));

        const [maintenanceSnapshots, inspectionSnapshots, documentSnapshots] = await Promise.all([
          Promise.all(maintenancePromises),
          Promise.all(inspectionPromises),
          Promise.all(documentPromises),
        ]);

        const allMaintenance = maintenanceSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceLog)));
        const allInspections = inspectionSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Inspection)));
        const allDocuments = documentSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Document)));

        setMaintenanceLogs(allMaintenance);
        setInspections(allInspections);
        setDocuments(allDocuments);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoadingSubcollections(false);
      }
    };

    fetchSubcollections();
  }, [properties, firestore]);

  const isLoading = isLoadingProperties || isLoadingSubcollections;
  
  const propertyMap = useMemo(() => 
    properties?.reduce((map, prop) => {
      map[prop.id] = prop.address;
      return map;
    }, {} as Record<string, string>) ?? {}
  , [properties]);

  const activeProperties = useMemo(() => properties?.filter(p => p.status !== 'Deleted') ?? [], [properties]);
  const openMaintenanceCount = useMemo(() => maintenanceLogs.filter(log => log.status === 'Open').length, [maintenanceLogs]);
  const upcomingInspectionsCount = useMemo(() => inspections.filter(insp => {
      const scheduledDate = insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate();
      return insp.status === 'Scheduled' && isFuture(scheduledDate);
  }).length, [inspections]);
  const totalDocumentsCount = useMemo(() => documents.length, [documents]);

  const recentActivities = useMemo(() => 
    maintenanceLogs
        .sort((a,b) => ((b.reportedDate as Timestamp)?.toMillis?.() ?? 0) - ((a.reportedDate as Timestamp)?.toMillis?.() ?? 0))
        .slice(0, 4)
        .map(log => ({
            id: log.id,
            property: propertyMap[log.propertyId] || 'Unknown Property',
            activity: log.title,
            date: format((log.reportedDate as Timestamp).toDate(), 'dd/MM/yyyy'),
        }))
  , [maintenanceLogs, propertyMap]);

  const upcomingTasks = useMemo(() => {
    const inspectionTasks = inspections
        .filter(insp => {
            const scheduledDate = insp.scheduledDate instanceof Date ? insp.scheduledDate : (insp.scheduledDate as Timestamp).toDate();
            return insp.status === 'Scheduled' && isFuture(scheduledDate)
        })
        .map(insp => ({
            id: `insp-${insp.id}`,
            task: insp.type || 'Inspection',
            property: propertyMap[insp.propertyId] || 'Unknown Property',
            status: 'Scheduled',
            dueDate: format((insp.scheduledDate as Timestamp).toDate(), 'dd/MM/yyyy'),
        }));
    
    const documentTasks = documents
        .map(doc => {
            const expiry = doc.expiryDate instanceof Date ? doc.expiryDate : (doc.expiryDate as Timestamp).toDate();
            return {
                ...doc,
                status: getDocumentStatus(expiry),
                expiryDate: expiry
            };
        })
        .filter(doc => doc.status === 'Expired' || doc.status === 'Expiring Soon')
        .map(doc => ({
            id: `doc-${doc.id}`,
            task: doc.title,
            property: propertyMap[doc.propertyId] || 'Unknown Property',
            status: doc.status,
            dueDate: format(doc.expiryDate, 'dd/MM/yyyy'),
        }));

        return [...inspectionTasks, ...documentTasks]
            .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .slice(0, 4);

  }, [inspections, documents, propertyMap]);


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
                        <TableCell>{activity.activity}</TableCell>
                        <TableCell className="text-right">{activity.date}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
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
                        <div className="font-medium">{task.task}</div>
                        <div className="text-sm text-muted-foreground">
                            {task.property}
                        </div>
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
             ) : (
                <div className="text-center text-muted-foreground py-10">No upcoming tasks.</div>
             )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
