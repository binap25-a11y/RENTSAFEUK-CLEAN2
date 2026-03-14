'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, limit, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Home, 
  Loader2, 
  Users, 
  Wrench, 
  CalendarCheck, 
  ShieldAlert,
  ChevronRight,
  AlertCircle,
  FileWarning,
  Clock,
  LayoutDashboard,
  Building2,
  TrendingUp,
  History
} from 'lucide-react';
import Link from 'next/link';
import { format, isBefore, addDays } from 'date-fns';

interface Property { id: string; status: string; landlordId: string; }
interface Tenant { id: string; status: string; landlordId: string; }
interface Repair { id: string; status: string; landlordId: string; title: string; priority: string; reportedDate: any; }
interface Document { id: string; expiryDate: any; landlordId: string; title: string; }
interface Inspection { id: string; status: string; landlordId: string; scheduledDate: any; type: string; }

const toDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Role Verification Handshake
  useEffect(() => {
    if (isUserLoading || !user || !firestore) return;

    const checkRole = async () => {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          const role = snap.data().role;
          setUserRole(role);
          if (role === 'tenant') {
            router.replace('/tenant/dashboard');
            return;
          }
        }
        setIsLoadingProfile(false);
      } catch (e) {
        console.error("Dashboard role check failed:", e);
        setIsLoadingProfile(false);
      }
    };

    checkRole();
  }, [user, isUserLoading, firestore, router]);

  // High-Performance Portfolio Queries
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid), where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance']));
  }, [user, firestore]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'tenants'), where('landlordId', '==', user.uid), where('status', '==', 'Active'));
  }, [user, firestore]);
  const { data: tenants } = useCollection<Tenant>(tenantsQuery);

  const repairsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'repairs'), where('landlordId', '==', user.uid), where('status', 'in', ['Open', 'In Progress']), orderBy('reportedDate', 'desc'), limit(5));
  }, [user, firestore]);
  const { data: repairs } = useCollection<Repair>(repairsQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'documents'), where('landlordId', '==', user.uid));
  }, [user, firestore]);
  const { data: documents } = useCollection<Document>(docsQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'inspections'), where('landlordId', '==', user.uid), where('status', '==', 'Scheduled'), limit(5));
  }, [user, firestore]);
  const { data: inspections } = useCollection<Inspection>(inspectionsQuery);

  // Compliance Analytics
  const complianceStats = useMemo(() => {
    if (!documents) return { expired: 0, expiringSoon: 0 };
    const today = new Date();
    const soon = addDays(today, 90);
    
    return documents.reduce((acc, doc) => {
      const expiry = toDate(doc.expiryDate);
      if (!expiry) return acc;
      if (isBefore(expiry, today)) acc.expired++;
      else if (isBefore(expiry, soon)) acc.expiringSoon++;
      return acc;
    }, { expired: 0, expiringSoon: 0 });
  }, [documents]);

  if (isUserLoading || isLoadingProfile) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Establishing Command Center...</p>
      </div>
    );
  }

  if (userRole === 'tenant') return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Portfolio Executive</h1>
        <p className="text-muted-foreground font-medium text-lg">Central command for your managed estate.</p>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/properties" className="block">
          <Card className="hover:shadow-xl transition-all border-none shadow-md group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Managed Assets</CardTitle>
              <Building2 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{properties?.length || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Portfolio Capacity</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/tenants" className="block">
          <Card className="hover:shadow-xl transition-all border-none shadow-md group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Residents</CardTitle>
              <Users className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{tenants?.length || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Verified Tenancies</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/maintenance/logged" className="block">
          <Card className="hover:shadow-xl transition-all border-none shadow-md group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Open Repairs</CardTitle>
              <Wrench className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{repairs?.length || 0}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Maintenance Queue</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/documents" className="block">
          <Card className={cn(
            "hover:shadow-xl transition-all border-none shadow-md group",
            complianceStats.expired > 0 ? "bg-destructive/5" : ""
          )}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Legal Compliance</CardTitle>
              <ShieldAlert className={cn(
                "h-4 w-4 transition-transform group-hover:scale-110",
                complianceStats.expired > 0 ? "text-destructive" : "text-primary"
              )} />
            </CardHeader>
            <CardContent>
              <div className={cn("text-3xl font-bold", complianceStats.expired > 0 && "text-destructive")}>
                {complianceStats.expired}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Expired Certificates</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Quick Actions & High Priority */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                Management Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button asChild variant="outline" className="h-20 flex-col gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <Link href="/dashboard/properties/add">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase">Onboard Asset</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-20 flex-col gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <Link href="/dashboard/maintenance">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase">Log Repair</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-20 flex-col gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <Link href="/dashboard/inspections">
                  <CalendarCheck className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase">New Inspection</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Repairs */}
          <Card className="border-none shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div className="space-y-1">
                <CardTitle className="text-lg font-headline">Maintenance Priority</CardTitle>
                <CardDescription className="text-xs">Active requests requiring attention.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-primary font-bold uppercase tracking-widest text-[9px]">
                <Link href="/dashboard/maintenance/logged">View All History</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {!repairs?.length ? (
                <div className="py-12 text-center text-muted-foreground italic bg-muted/5">No active repairs.</div>
              ) : (
                <div className="divide-y">
                  {repairs.map((r) => (
                    <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          r.priority === 'Emergency' ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary"
                        )}>
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold group-hover:text-primary transition-colors">{r.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={r.priority === 'Emergency' ? 'destructive' : 'secondary'} className="text-[8px] h-4 px-1.5 uppercase">{r.priority}</Badge>
                            <span className="text-[10px] text-muted-foreground">{r.reportedDate ? format(toDate(r.reportedDate)!, 'd MMM') : ''}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" asChild><Link href={`/dashboard/maintenance/${r.id}?propertyId=${r.propertyId}`}><ChevronRight className="h-4 w-4" /></Link></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Compliance Card */}
          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-destructive/5 border-b border-destructive/10">
              <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Audit Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Expired Documents</span>
                  <Badge variant={complianceStats.expired > 0 ? "destructive" : "secondary"} className="h-5">{complianceStats.expired}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Expiring Soon (90d)</span>
                  <Badge variant="outline" className="h-5">{complianceStats.expiringSoon}</Badge>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full text-[10px] font-bold uppercase tracking-widest border-destructive/20 hover:bg-destructive/5">
                <Link href="/dashboard/documents">Resolve Audit Issues</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming Inspections */}
          <Card className="border-none shadow-lg">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Inspection Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!inspections?.length ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">No scheduled visits.</div>
              ) : (
                <div className="divide-y">
                  {inspections.map(i => (
                    <div key={i.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                      <div>
                        <p className="text-xs font-bold">{i.type}</p>
                        <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{format(toDate(i.scheduledDate)!, 'PPP')}</p>
                      </div>
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link href={`/dashboard/inspections/${i.id}?propertyId=${i.propertyId}`}><Eye className="h-3.5 w-3.5" /></Link></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-4 pb-4 border-t bg-muted/5">
              <Button variant="link" className="w-full text-[9px] uppercase font-bold tracking-widest text-primary h-auto p-0" asChild>
                <Link href="/dashboard/inspections">View Full Schedule</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');
function Eye(props: any) { return <History {...props} />; }
