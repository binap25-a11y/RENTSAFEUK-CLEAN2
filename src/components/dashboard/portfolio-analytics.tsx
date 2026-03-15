
'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Loader2, Banknote, TrendingUp } from 'lucide-react';
import { safeToDate } from '@/lib/date-utils';

// UK Tax Year Month Sequence
const TAX_MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'January', 'February', 'March'
];

const chartConfig = {
  income: {
    label: 'Income',
    color: 'hsl(var(--primary))',
  },
  expenses: {
    label: 'Expenses',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

export function PortfolioAnalytics() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [taxYearStart, setTaxYearStart] = React.useState<number | null>(null);

  React.useEffect(() => {
    const now = new Date();
    // If before April 6, previous tax year is active
    const start = (now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 6)) ? now.getFullYear() - 1 : now.getFullYear();
    setTaxYearStart(start);
  }, []);

  // Fetch Rent Payments (all for now, filter in memory for tax year flexibility)
  const rentQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'rentPayments'),
      where('landlordId', '==', user.uid)
    );
  }, [user, firestore]);
  const { data: rentPayments, isLoading: isLoadingRent } = useCollection(rentQuery);

  // Fetch Expenses
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'expenses'),
      where('landlordId', '==', user.uid)
    );
  }, [user, firestore]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection(expensesQuery);

  // Fetch Maintenance Repairs
  const repairsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'repairs'),
        where('landlordId', '==', user.uid)
    );
  }, [user, firestore]);
  const { data: allRepairs, isLoading: isLoadingRepairs } = useCollection(repairsQuery);

  const chartData = React.useMemo(() => {
    if (!rentPayments || !allExpenses || !allRepairs || !taxYearStart) return [];

    return TAX_MONTHS.map((monthName) => {
      const monthIdx = TAX_MONTHS.indexOf(monthName);
      const calendarYear = monthIdx >= 9 ? taxYearStart + 1 : taxYearStart;
      const jsMonth = (monthIdx + 3) % 12; // JS Date months are 0-11, April is 3

      // Aggregate Income for this Tax Month
      const monthIncome = rentPayments
        .filter((p) => p.month === monthName && p.year === calendarYear && p.status === 'Paid')
        .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

      // Aggregate Base Expenses for this Tax Month
      const monthBaseExpenses = allExpenses
        .filter((e) => {
          const d = safeToDate(e.date);
          return d && d.getFullYear() === calendarYear && d.getMonth() === jsMonth;
        })
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      // Aggregate Repair Costs for this Tax Month
      const monthRepairExpenses = allRepairs
        .filter((r) => {
            const d = safeToDate(r.reportedDate);
            return d && d.getFullYear() === calendarYear && d.getMonth() === jsMonth;
        })
        .reduce((sum, r) => sum + (Number(r.expectedCost || r.estimatedCost || 0)), 0);

      return {
        month: monthName.substring(0, 3),
        income: monthIncome,
        expenses: monthBaseExpenses + monthRepairExpenses,
      };
    });
  }, [rentPayments, allExpenses, allRepairs, taxYearStart]);

  const totals = React.useMemo(() => {
    const income = chartData.reduce((sum, d) => sum + d.income, 0);
    const expenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
    return { income, expenses, net: income - expenses };
  }, [chartData]);

  if (isLoadingRent || isLoadingExpenses || isLoadingRepairs || !taxYearStart) {
    return (
      <Card className="border-none shadow-lg h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Syncing Analytics Ledger...</p>
        </div>
      </Card>
    );
  }

  const hasData = totals.income > 0 || totals.expenses > 0;

  if (!hasData) {
    return (
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Tax Year Performance: {taxYearStart}/{ (taxYearStart + 1).toString().slice(-2) }
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex flex-col items-center justify-center text-center p-6">
          <div className="p-4 rounded-full bg-muted/20 mb-4">
            <Banknote className="h-10 w-10 text-muted-foreground/20" />
          </div>
          <p className="text-sm font-bold text-foreground">Registry trail standby for {taxYearStart}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
            Income and expenses logged in your financial ledger will update this real-time analytics chart.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-lg overflow-hidden text-left">
      <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
        <div className="text-left">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Portfolio Analytics: {taxYearStart}/{ (taxYearStart + 1).toString().slice(-2) }
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
            Real-time UK Tax Year (April-April) Flow
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Net Tax Position</p>
          <p className={`text-xl font-bold ${totals.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
            £{totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-6 sm:p-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-income)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-income)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-expenses)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-expenses)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={10}
              fontWeight="bold"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Area
              dataKey="expenses"
              type="monotone"
              fill="url(#fillExpenses)"
              stroke="var(--color-expenses)"
              strokeWidth={2}
              stackId="a"
            />
            <Area
              dataKey="income"
              type="monotone"
              fill="url(#fillIncome)"
              stroke="var(--color-income)"
              strokeWidth={2}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <div className="flex items-center gap-6 p-4 bg-muted/10 border-t justify-center">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rental Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Allowable Expenses</span>
        </div>
      </div>
    </Card>
  );
}
