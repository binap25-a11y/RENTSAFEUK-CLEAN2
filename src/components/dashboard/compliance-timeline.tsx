'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Loader2, 
  ChevronRight,
  CalendarDays,
  FileWarning
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
  isBefore,
  addDays
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
    street: string;
    postcode: string;
  };
}

/**
 * @fileOverview Global Compliance Timeline Widget
 * Visualizes legal certificate expirations across a 12-month rolling window.
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
      acc[p.id] = p.address?.street || 'Assigned Asset';
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
        label: format(monthDate, 'MMM'),
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
          <CardTitle className="text-lg font-headline flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Compliance Roadmap
          </CardTitle>
          <CardDescription className="text-xs font-medium">12-month rolling visual audit trail</CardDescription>
        </div>
        {criticalCount > 0 && (
            <Badge variant="destructive" className="animate-pulse gap-1.5 font-bold uppercase text-[9px] h-7 px-3 shadow-lg">
                <FileWarning className="h-3.5 w-3.5" />
                {criticalCount} Critical Fixes Required
            </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="flex p-6 gap-4 min-w-[1200px]">
            {timelineData.map((month, idx) => {
              const isCurrent = idx === 0;
              return (
                <div key={idx} className={cn(
                    "flex-1 min-w-[180px] rounded-2xl border-2 transition-all group",
                    isCurrent ? "bg-primary/[0.03] border-primary/20 ring-1 ring-primary/10" : "bg-muted/5 border-muted/50"
                )}>
                  <div className={cn(
                      "p-3 border-b-2 flex items-center justify-between",
                      isCurrent ? "bg-primary/10 border-primary/10" : "bg-muted/30 border-muted/20"
                  )}>
                    <span className={cn("text-xs font-black uppercase tracking-widest", isCurrent ? "text-primary" : "text-muted-foreground")}>
                        {month.label}
                    </span>
                    <span className="text-[9px] font-bold opacity-40">{month.year}</span>
                  </div>
                  <div className="p-3 space-y-2 min-h-[180px]">
                    {month.expirations.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-10 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                    ) : (
                        month.expirations.map(doc => {
                            const isPastDue = isBefore(safeToDate(doc.expiryDate) || new Date(), today);
                            return (
                                <Link 
                                    key={doc.id}
                                    href={`/dashboard/documents/${doc.id}/edit?propertyId=${doc.propertyId}`}
                                    className={cn(
                                        "block p-2 rounded-xl border text-[10px] font-bold transition-all hover:scale-[1.03] shadow-sm",
                                        isPastDue ? "bg-destructive/5 border-destructive/20 text-destructive" : "bg-white border-muted-foreground/10 text-foreground hover:border-primary/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-1 mb-1">
                                        <span className="truncate max-w-[100px]">{doc.documentType}</span>
                                        {isPastDue && <AlertTriangle className="h-3 w-3 shrink-0" />}
                                    </div>
                                    <p className="opacity-60 truncate font-medium text-[9px] uppercase tracking-tighter">
                                        {propertyMap[doc.propertyId] || 'Assigned Asset'}
                                    </p>
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
      <CardFooter className="bg-muted/5 border-t py-4 px-6 justify-between items-center">
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Registry updated: {format(new Date(), 'HH:mm')}
          </p>
          <Button variant="ghost" size="sm" asChild className="h-8 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Link href="/dashboard/documents">Full Compliance Vault <ChevronRight className="h-3 w-3 ml-1" /></Link>
          </Button>
      </CardFooter>
    </Card>
  );
}
