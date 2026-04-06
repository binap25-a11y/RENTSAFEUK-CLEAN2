'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, getDoc, limit, orderBy } from 'firebase/firestore';
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
  LayoutDashboard,
  Building2,
  TrendingUp,
  Clock,
  Banknote,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import Link from 'next/link';
import { format, isBefore, addDays, getYear } from 'date-fns';
import { PortfolioAnalytics } from '@/components/dashboard/portfolio-analytics';
import { ComplianceTimeline } from '@/components/dashboard/compliance-timeline';
import { safeToDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface Property { id: string; status: string; landlordId: string; }
interface Tenant { id: string; status: string; landlordId: string; }
interface Repair { id: string; status: string; landlordId: string; title: string; priority: string; reportedDate: any; propertyId: string; estimatedCost?: number; expectedCost?: number; }
interface DocumentRecord { id: string; expiryDate: any; landlordId: string; title: string; }
interface Inspection { id: string; status: string; landlordId: string; scheduledDate: any; type: string; propertyId: string; }
interface Expense { id: string; amount: number; date: any; }
interface RentPayment { id: string; amountPaid?: number; status: string; month: string; year: number; }

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

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
  const { data: properties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

  const tenantsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'tenants'), where('landlordId', '==', user.uid), where('status', '==', 'Active'));
  }, [user, firestore]);
  const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

  // Fetch all repairs for the landlord
  const repairsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'repairs'), 
      where('landlordId', '==', user.uid),
      limit(500)
    );
  }, [user, firestore]);
  const { data: rawRepairs, isLoading: isLoadingRepairs } = useCollection<Repair>(repairsQuery);

  const openRepairs = useMemo(() => {
    if (!rawRepairs) return [];
    return rawRepairs.filter(r => ['Open', 'In Progress'].includes(r.status));
  }, [rawRepairs]);

  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'expenses'), where('landlordId', '==', user.uid), limit(500));
  }, [user, firestore]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  const rentQuery = useMemoFirebase(() => {
    if (!user || !firestore || !today) return null;
    return query(collection(firestore, 'rentPayments'), where('landlordId', '==', user.uid), where('year', '==', getYear(today)));
  }, [user, firestore, today]);
  const { data: rentPayments, isLoading: isLoadingRent } = useCollection<RentPayment>(rentQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'documents'), where('landlordId', '==', user.uid));
  }, [user, firestore]);
  const { data: documents, isLoading: isLoadingDocs } = useCollection<DocumentRecord>(docsQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'inspections'), where('landlordId', '==', user.uid), where('status', '==', 'Scheduled'), limit(5));
  }, [user, firestore]);
  const { data: inspections, isLoading: isLoadingInspections } = useCollection<Inspection>(inspectionsQuery);

  // Financial Aggregation
  const financialSummary = useMemo(() => {
    if (!rentPayments || !allExpenses || !rawRepairs) return { income: 0, expenses: 0, net: 0 };
    
    const income = rentPayments.reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0);
    const baseExpenses = allExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const repairExpenses = rawRepairs.reduce((acc, r) => acc + (Number(r.expectedCost || r.estimatedCost || 0)), 0);
    
    const totalExpenses = baseExpenses + repairExpenses;
    return { income, expenses: totalExpenses, net: income - totalExpenses };
  }, [rentPayments, allExpenses, rawRepairs]);

  // Compliance Analytics
  const complianceStats = useMemo(() => {
    if (!documents || !today) return { expired: 0, expiringSoon: 0 };
    const soon = addDays(today, 90);
    
    return documents.reduce((acc, doc) => {
      const expiry = safeToDate(doc.expiryDate);
      if (!expiry) return acc;
      if (isBefore(expiry, today)) acc.expired++;
      else if (isBefore(expiry, soon)) acc.expiringSoon++;
      return acc;
    }, { expired: 0, expiringSoon: 0 });
  }, [documents, today]);

  if (isUserLoading || isLoadingProfile) {
    return (
      <div className="flex h-[60vh] w-full flex-col items-center justify-center gap-4">
        <div className="bg-primary/5 p-10 rounded-full">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse text-center">
            Establishing Command Center...
        </p>
      </div>
    );
  }

  if (userRole === 'tenant') return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Property Portfolio</h1>
        <p className="text-muted-foreground font-medium text-lg">Central command for your managed rental properties.</p>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/properties" className="block">
          <Card className="hover:shadow-xl transition-all border-none shadow-md group h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-left">Managed Properties</CardTitle>
              <Building2 className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent className="text-left">
              <div className="text-3xl font-bold">
                {isLoadingProps ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /> : (properties?.length || 0)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />Portfolio Capacity</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/tenants" className="block">
          <Card className="hover:shadow-xl transition-all border-none shadow-md group h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-left">Active Tenants</CardTitle>
              <Users className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent className="text-left">
              <div className="text-3xl font-bold">
                {isLoadingTenants ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /> : (tenants?.length || 0)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Verified Tenancies</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/maintenance/logged" className="block">
          <Card className="hover:shadow-xl transition-all border-none shadow-md group h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-left">Open Repairs</CardTitle>
              <Wrench className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
            </CardHeader>
            <CardContent className="text-left">
              <div className="text-3xl font-bold">
                {isLoadingRepairs ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /> : openRepairs.length}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Maintenance Queue</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/documents" className="block">
          <Card className={cn(
            "hover:shadow-xl transition-all border-none shadow-md group h-full",
            complianceStats.expired > 0 ? "bg-destructive/[0.02] border-destructive/10 border" : ""
          )}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-left">Legal Compliance</CardTitle>
              <ShieldAlert className={cn(
                "h-4 w-4 transition-transform group-hover:scale-110",
                complianceStats.expired > 0 ? "text-destructive" : "text-primary"
              )} />
            </CardHeader>
            <CardContent className="text-left">
              <div className={cn("text-3xl font-bold", complianceStats.expired > 0 && "text-destructive")}>
                {isLoadingDocs ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /> : complianceStats.expired}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Expired Certificates</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* COMPLIANCE ROADMAP - Visual Timeline */}
      <ComplianceTimeline />

      {/* Portfolio Financial Summary */}
      <Card className="border-none shadow-lg overflow-hidden bg-primary/5 border border-primary/10">
        <CardHeader className="border-b bg-primary/10 flex flex-row items-center justify-between">
            <div className="text-left">
                <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-primary" />
                    Financial Overview (YTD)
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Aggregated performance across all assets</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="h-8 font-bold uppercase text-[9px] tracking-widest text-primary">
                <Link href="/dashboard/expenses">Detailed Ledger <ChevronRight className="ml-1 h-3 w-3"/></Link>
            </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x p-0">
            <div className="p-6 flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Income Received</p>
                <div className="flex items-center gap-2 text-green-600">
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="text-2xl font-bold">
                      {isLoadingRent ? <Loader2 className="h-5 w-5 animate-spin" /> : `£${financialSummary.income.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </span>
                </div>
            </div>
            <div className="p-6 flex flex-col items-center justify-center text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Expenses (Incl. Repairs)</p>
                <div className="flex items-center gap-2 text-destructive">
                    <ArrowDownRight className="h-4 w-4" />
                    <span className="text-2xl font-bold">
                      {isLoadingExpenses || isLoadingRepairs ? <Loader2 className="h-5 w-5 animate-spin" /> : `£${financialSummary.expenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    </span>
                </div>
            </div>
            <div className={cn("p-6 flex flex-col items-center justify-center text-center", financialSummary.net >= 0 ? "bg-green-50/50" : "bg-destructive/5")}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Net Cashflow</p>
                <div className={cn("text-2xl font-bold", financialSummary.net >= 0 ? "text-primary" : "text-destructive")}>
                    {isLoadingRent || isLoadingExpenses || isLoadingRepairs ? <Loader2 className="h-5 w-5 animate-spin" /> : `£${financialSummary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <PortfolioAnalytics />

          {/* Quick Actions */}
          <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-primary/5 border-b text-left">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                Management Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button asChild variant="outline" className="h-20 flex-col gap-2 border-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                <Link href="/dashboard/properties/add">
                  <PlusCircle className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase">Onboard Property</span>
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
          <Card className="border-none shadow-lg text-left">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4 text-left">
              <div className="space-y-1 text-left">
                <CardTitle className="text-lg font-headline">Maintenance Priority</CardTitle>
                <CardDescription className="text-xs">Active requests requiring attention.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-primary font-bold uppercase tracking-widest text-[9px]">
                <Link href="/dashboard/maintenance/logged">View All History</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingRepairs ? (
                <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/20" /></div>
              ) : !openRepairs.length ? (
                <div className="py-12 text-center text-muted-foreground italic bg-muted/5">No active repairs requiring attention.</div>
              ) : (
                <div className="divide-y">
                  {openRepairs.slice(0, 5).map((r) => (
                    <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          r.priority === 'Emergency' ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary"
                        )}>
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold group-hover:text-primary transition-colors">{r.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={r.priority === 'Emergency' ? 'destructive' : 'secondary'} className="text-[8px] h-4 px-1.5 uppercase">{r.priority}</Badge>
                            <span className="text-[10px] text-muted-foreground">{r.reportedDate ? format(safeToDate(r.reportedDate)!, 'd MMM') : ''}</span>
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
          <Card className={cn(
            "hover:shadow-xl transition-all border-none shadow-lg group text-left",
            complianceStats.expired > 0 ? "bg-destructive/[0.02]" : ""
          )}>
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
                  <Badge variant={complianceStats.expired > 0 ? "destructive" : "secondary"} className="h-5 font-bold">
                    {isLoadingDocs ? "..." : complianceStats.expired}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Expiring Soon (90d)</span>
                  <Badge variant="outline" className="h-5 font-bold">
                    {isLoadingDocs ? "..." : complianceStats.expiringSoon}
                  </Badge>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full text-[10px] font-bold uppercase tracking-widest border-destructive/20 hover:bg-destructive/5 h-11">
                <Link href="/dashboard/documents">Resolve Audit Issues</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming Inspections */}
          <Card className="border-none shadow-lg text-left">
            <CardHeader className="border-b pb-4 text-left">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Inspection Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingInspections ? (
                <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/20" /></div>
              ) : !inspections?.length ? (
                <div className="p-8 text-center text-xs text-muted-foreground italic">No scheduled visits.</div>
              ) : (
                <div className="divide-y">
                  {inspections.map(i => (
                    <div key={i.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">
                      <div className="text-left">
                        <p className="text-xs font-bold">{i.type}</p>
                        <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{format(safeToDate(i.scheduledDate)!, 'PPP')}</p>
                      </div>
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link href={`/dashboard/inspections/${i.id}?propertyId=${i.propertyId}`}><ChevronRight className="h-3.5 w-3.5" /></Link></Button>
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
