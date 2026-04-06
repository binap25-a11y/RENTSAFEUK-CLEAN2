'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Loader2, 
  ChevronRight,
  CalendarDays,
  FileWarning,
  MapPin
} from 'lucide-react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase 
} from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { 
  format, 
  addMonths, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval, 
  eachMonthOfInterval,
  isBefore
} from 'date-fns';
import { safeToDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface DocumentRecord {
  id: string;
  title: string;
  documentType: string;
  propertyId: string;
  expiryDate: any;
}

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
}

/**
 * @fileOverview Global Compliance Timeline Widget
 * Visualizes legal certificate expirations across a 12-month rolling window.
 * Enhanced for maximum visibility with high-contrast black text and full property addresses.
 */

export function ComplianceTimeline() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'properties'), where('landlordId', '==', user.uid));
  }, [user, firestore]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'documents'), 
      where('landlordId', '==', user.uid),
      limit(200)
    );
  }, [user, firestore]);
  const { data: documents, isLoading } = useCollection<DocumentRecord>(docsQuery);

  const propertyMap = useMemo(() => {
    if (!properties) return {};
    return properties.reduce((acc, p) => {
      const addr = [
        p.address?.nameOrNumber,
        p.address?.street,
        p.address?.city,
        p.address?.postcode
      ].filter(Boolean).join(', ');
      
      acc[p.id] = addr || 'Assigned Asset';
      return acc;
    }, {} as Record<string, string>);
  }, [properties]);

  const timelineData = useMemo(() => {
    if (!documents || !today) return [];

    const start = startOfMonth(today);
    const end = endOfMonth(addMonths(today, 11));
    const months = eachMonthOfInterval({ start, end });

    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const expirations = documents.filter(doc => {
        const expiry = safeToDate(doc.expiryDate);
        if (!expiry) return false;
        return isWithinInterval(expiry, { start: monthStart, end: monthEnd });
      });

      return {
        date: monthDate,
        label: format(monthDate, 'MMMM'),
        year: format(monthDate, 'yyyy'),
        expirations: expirations.sort((a, b) => {
            const dA = safeToDate(a.expiryDate)?.getTime() || 0;
            const dB = safeToDate(b.expiryDate)?.getTime() || 0;
            return dA - dB;
        })
      };
    });
  }, [documents, today]);

  const criticalCount = useMemo(() => {
    if (!documents || !today) return 0;
    return documents.filter(doc => {
        const expiry = safeToDate(doc.expiryDate);
        return expiry && isBefore(expiry, today);
    }).length;
  }, [documents, today]);

  if (isLoading || !today) {
    return (
      <Card className="border-none shadow-lg h-[300px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-lg overflow-hidden text-left bg-card">
      <CardHeader className="bg-primary/5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6 px-6">
        <div className="text-left space-y-1">
          <CardTitle className="text-lg font-headline flex items-center gap-2 text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" />
            Compliance Roadmap
          </CardTitle>
          <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">12-month rolling visual audit trail</CardDescription>
        </div>
        {criticalCount > 0 && (
            <Badge variant="destructive" className="animate-pulse gap-1.5 font-bold uppercase text-[10px] h-8 px-4 shadow-lg">
                <FileWarning className="h-4 w-4" />
                {criticalCount} Overdue Certificates
            </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="flex p-6 gap-6 min-w-[1600px]">
            {timelineData.map((month, idx) => {
              const isCurrent = idx === 0;
              return (
                <div key={idx} className={cn(
                    "flex-1 min-w-[300px] rounded-[2rem] border-2 transition-all group",
                    isCurrent ? "bg-primary/[0.03] border-primary/30 ring-4 ring-primary/5 shadow-inner" : "bg-muted/5 border-muted/50"
                )}>
                  <div className={cn(
                      "p-5 border-b-2 flex flex-col text-left",
                      isCurrent ? "bg-primary/10 border-primary/10" : "bg-muted/30 border-muted/20"
                  )}>
                    <span className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isCurrent ? "text-primary" : "text-muted-foreground")}>
                        {month.year}
                    </span>
                    <span className={cn("text-lg font-black uppercase tracking-tight", isCurrent ? "text-primary" : "text-foreground")}>
                        {month.label}
                    </span>
                  </div>
                  <div className="p-5 space-y-4 min-h-[280px]">
                    {month.expirations.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 opacity-10 group-hover:opacity-30 transition-opacity">
                            <ShieldCheck className="h-12 w-12 text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-widest mt-2">All Clear</p>
                        </div>
                    ) : (
                        month.expirations.map(doc => {
                            const isPastDue = isBefore(safeToDate(doc.expiryDate) || new Date(), today);
                            return (
                                <Link 
                                    key={doc.id}
                                    href={`/dashboard/documents/${doc.id}/edit?propertyId=${doc.propertyId}`}
                                    className={cn(
                                        "block p-5 rounded-2xl border-2 transition-all hover:scale-[1.03] shadow-lg",
                                        isPastDue ? "bg-destructive/5 border-destructive/40" : "bg-background border-muted-foreground/10 hover:border-primary/40"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <span className={cn(
                                            "text-sm font-black leading-tight break-words flex-1 uppercase tracking-tight",
                                            isPastDue ? "text-destructive" : "text-foreground"
                                        )}>
                                            {doc.documentType}
                                        </span>
                                        {isPastDue ? (
                                            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                                        ) : (
                                            <Clock className="h-5 w-5 shrink-0 text-primary" />
                                        )}
                                    </div>
                                    <div className="space-y-3">
                                        <p className={cn(
                                            "text-[11px] font-bold leading-snug flex items-start gap-2",
                                            isPastDue ? "text-destructive" : "text-foreground"
                                        )}>
                                            <MapPin className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isPastDue ? "text-destructive" : "text-primary")} />
                                            <span className="flex-1 break-words">
                                                {propertyMap[doc.propertyId] || 'Assigned Asset'}
                                            </span>
                                        </p>
                                        <div className="flex items-center justify-between pt-2 border-t border-muted/50">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expiry</span>
                                            <span className={cn(
                                                "text-xs font-black tabular-nums",
                                                isPastDue ? "text-destructive" : "text-foreground"
                                            )}>
                                                {format(safeToDate(doc.expiryDate)!, 'dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
      <CardFooter className="bg-muted/5 border-t py-4 px-6 flex items-center justify-between">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Registry Sync: {format(new Date(), 'HH:mm')}
          </p>
          <Button variant="ghost" size="sm" asChild className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5">
              <Link href="/dashboard/documents">Open Compliance Vault <ChevronRight className="h-3 w-3 ml-1" /></Link>
          </Button>
      </CardFooter>
    </Card>
  );
}