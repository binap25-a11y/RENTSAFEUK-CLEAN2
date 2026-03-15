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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
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
  const currentYear = new Date().getFullYear();

  // 1. Fetch Rent Payments for the current year (Income)
  const rentQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'rentPayments'),
      where('landlordId', '==', user.uid),
      where('year', '==', currentYear)
    );
  }, [user, firestore, currentYear]);
  const { data: rentPayments, isLoading: isLoadingRent } = useCollection(rentQuery);

  // 2. Fetch Expenses for the current year (Outgoings)
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'expenses'),
      where('landlordId', '==', user.uid)
    );
  }, [user, firestore]);
  const { data: allExpenses, isLoading: isLoadingExpenses } = useCollection(expensesQuery);

  const chartData = React.useMemo(() => {
    if (!rentPayments || !allExpenses) return [];

    return MONTHS.map((monthName, index) => {
      // Aggregate verified income for this specific month
      const monthIncome = rentPayments
        .filter((p) => p.month === monthName && p.status === 'Paid')
        .reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

      // Aggregate ledger expenses for this specific month
      const monthExpenses = allExpenses
        .filter((e) => {
          const d = safeToDate(e.date);
          return d && d.getFullYear() === currentYear && d.getMonth() === index;
        })
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

      return {
        month: monthName.substring(0, 3),
        income: monthIncome,
        expenses: monthExpenses,
      };
    });
  }, [rentPayments, allExpenses, currentYear]);

  const totals = React.useMemo(() => {
    const income = chartData.reduce((sum, d) => sum + d.income, 0);
    const expenses = chartData.reduce((sum, d) => sum + d.expenses, 0);
    return { income, expenses, net: income - expenses };
  }, [chartData]);

  if (isLoadingRent || isLoadingExpenses) {
    return (
      <Card className="border-none shadow-lg h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aggregating Ledger...</p>
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
            Financial Performance: {currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex flex-col items-center justify-center text-center p-6">
          <div className="p-4 rounded-full bg-muted/20 mb-4">
            <Banknote className="h-10 w-10 text-muted-foreground/20" />
          </div>
          <p className="text-sm font-bold text-foreground">No financial data recorded for {currentYear}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
            Log rent collection and maintenance expenses to populate this chronological audit.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="bg-primary/5 border-b flex flex-row items-center justify-between">
        <div className="text-left">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Portfolio Analytics: {currentYear}
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest mt-1">
            Verified Rent Income vs. Maintenance Ledger
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Net Position</p>
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
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Portfolio Outgoings</span>
        </div>
      </div>
    </Card>
  );
}
