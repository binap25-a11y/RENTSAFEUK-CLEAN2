'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { expenses, annualSummaries, rentStatement, properties } from '@/data/mock-data';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';

const expenseSchema = z.object({
  property: z.string({ required_error: 'Please select a property.' }),
  date: z.date({ required_error: 'Please select a date.' }),
  expenseType: z.string({ required_error: 'Please select an expense type.' }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  paidBy: z.string().min(1, 'This field is required.'),
  notes: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export default function ExpensesPage() {
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>();
  const [summaryNotes, setSummaryNotes] = useState('');

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
  });

  useEffect(() => {
    // Set client-side-only default values to avoid hydration mismatch
    setSelectedYear(new Date().getFullYear().toString());
  }, []);
  
  function onSubmit(data: ExpenseFormValues) {
    toast({
      title: 'Expense Logged',
      description: 'The new expense has been successfully logged.',
    });
    console.log(data);
    form.reset({ date: new Date() });
  }

  // Data for Annual Summary
  const summaryForYear = annualSummaries.find(s => s.year.toString() === selectedYear);
  const totalRentalIncome = summaryForYear?.totalRentalIncome || 0;
  const totalExpensesForYear = expenses
    .filter(expense => new Date(expense.date).getFullYear().toString() === selectedYear)
    .reduce((acc, expense) => acc + expense.amount, 0);
  const netIncome = totalRentalIncome - totalExpensesForYear;

  useEffect(() => {
    setSummaryNotes(summaryForYear?.notes || '');
  }, [selectedYear, summaryForYear]);
  
  function handleSaveNotes() {
    toast({
      title: 'Notes Saved',
      description: `Your notes for ${selectedYear} have been saved.`,
    });
    // In a real app, you'd save this to a database
    console.log(`Saving notes for ${selectedYear}:`, summaryNotes);
  }

  // Total expenses for the tracker tab footer
  const totalExpenses = expenses.reduce((acc, expense) => acc + expense.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Finance Tracker</h1>
      <Tabs defaultValue="tracker">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tracker">Expense Tracker</TabsTrigger>
          <TabsTrigger value="summary">Annual Summary</TabsTrigger>
          <TabsTrigger value="statement">Rent Statement</TabsTrigger>
        </TabsList>

        {/* Expense Tracker Tab */}
        <TabsContent value="tracker" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Log New Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="property"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a property" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {properties.map((prop) => (
                              <SelectItem key={prop.id} value={prop.address}>
                                {prop.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn(
                                    'pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expenseType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expense Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[
                                'Repairs and Maintenance', 'Utilities', 'Insurance', 'Mortgage Interest', 'Cleaning', 'Gardening', 'Letting Agent Fees'
                              ].map((type) => (
                                <SelectItem key={type} value={type}>{type}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (£)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="100.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="paidBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Paid By</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Landlord, Tenant" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Add any relevant notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline">Cancel</Button>
                    <Button type="submit">Log Expense</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Logged Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Paid By</TableHead>
                    <TableHead className="text-right">Amount (£)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{expense.property}</TableCell>
                      <TableCell>{expense.type}</TableCell>
                      <TableCell>{expense.paidBy}</TableCell>
                      <TableCell className="text-right font-medium">{expense.amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-end font-bold">
              <div className="flex items-center gap-4">
                <span>Total Expenses:</span>
                <span>£{totalExpenses.toFixed(2)}</span>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Annual Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Annual Summary</CardTitle>
              <CardDescription>
                An overview of your rental finances for the selected year.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-start">
                 <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {annualSummaries.map((s) => (
                        <SelectItem key={s.year} value={s.year.toString()}>{s.year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className='h-full'>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Rental Income
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">£{totalRentalIncome.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card className='h-full'>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      £{totalExpensesForYear.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card className='h-full'>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${
                        netIncome >= 0 ? 'text-green-600' : 'text-destructive'
                      }`}
                    >
                      £{netIncome.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <Label htmlFor="notes" className="text-lg font-semibold">Notes / Improvements</Label>
                <Textarea 
                    id="notes" 
                    rows={5} 
                    className="mt-2" 
                    value={summaryNotes}
                    onChange={(e) => setSummaryNotes(e.target.value)}
                />
                 <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveNotes}>Save Notes</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Annual Rent Statement Tab */}
        <TabsContent value="statement">
          <Card>
            <CardHeader>
              <CardTitle>Annual Rent Statement</CardTitle>
              <CardDescription>A record of monthly rent payments received for a selected property.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-start">
                <Select onValueChange={setSelectedProperty}>
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.address}>
                        {prop.address}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProperty && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Rent Due (£)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentStatement.map((item) => (
                      <TableRow key={item.month}>
                        <TableCell className="font-medium">{item.month}</TableCell>
                        <TableCell>{item.rent.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={item.paid ? 'default' : 'destructive'}>
                            {item.paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
