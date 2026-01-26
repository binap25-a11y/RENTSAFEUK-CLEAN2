'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useState, useMemo } from 'react';
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
import { CalendarIcon, Loader2 } from 'lucide-react';
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
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  addDocumentNonBlocking,
} from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Label } from '@/components/ui/label';

// Schema for the form
const expenseSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }),
  date: z.date({ required_error: 'Please select a date.' }),
  expenseType: z.string({ required_error: 'Please select an expense type.' }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  paidBy: z.string().min(1, 'This field is required.'),
  notes: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

// Type for property documents from Firestore
interface Property {
  id: string;
  address: string;
}

// Type for expense documents from Firestore
interface Expense {
  id: string;
  propertyId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  expenseType: string;
  amount: number;
  paidBy: string;
  notes?: string;
}

export default function ExpensesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedProperty, setSelectedProperty] = useState('');

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
    },
  });

  // Fetch properties for dropdowns
  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
      where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);
  const { data: properties, isLoading: isLoadingProperties } =
    useCollection<Property>(propertiesQuery);

  // Fetch expenses for the selected property
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedProperty) return null;
    return query(
      collection(firestore, 'properties', selectedProperty, 'expenses'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedProperty]);
  const { data: expenses, isLoading: isLoadingExpenses } =
    useCollection<Expense>(expensesQuery);

  // Handle form submission
  async function onSubmit(data: ExpenseFormValues) {
    if (!user || !firestore) return;

    const newExpense = {
      ...data,
      ownerId: user.uid,
    };

    try {
      const expensesCollection = collection(
        firestore,
        'properties',
        data.propertyId,
        'expenses'
      );
      await addDocumentNonBlocking(expensesCollection, newExpense);

      toast({
        title: 'Expense Logged',
        description: 'The new expense has been successfully logged.',
      });
      form.reset({
        ...form.getValues(),
        expenseType: '',
        amount: undefined,
        paidBy: '',
        notes: '',
      });
       if (!selectedProperty) {
        setSelectedProperty(data.propertyId);
      }
    } catch (error) {
      console.error('Failed to log expense', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'There was an error saving the expense. Please try again.',
      });
    }
  }

  const totalExpenses = useMemo(() => {
    return expenses?.reduce((acc, expense) => acc + expense.amount, 0) || 0;
  }, [expenses]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Expense Tracker</h1>

      <Card>
        <CardHeader>
          <CardTitle>Log New Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingProperties ? 'Loading...' : 'Select a property'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties?.map((prop) => (
                          <SelectItem key={prop.id} value={prop.id}>
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
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[
                            'Repairs and Maintenance',
                            'Utilities',
                            'Insurance',
                            'Mortgage Interest',
                            'Cleaning',
                            'Gardening',
                            'Letting Agent Fees',
                          ].map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
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
                      <Textarea
                        placeholder="Add any relevant notes..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit">Log Expense</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logged Expenses</CardTitle>
          <CardDescription>
            View and manage expenses for your properties.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="property-filter">Filter by Property</Label>
            <Select onValueChange={setSelectedProperty} value={selectedProperty}>
              <SelectTrigger id="property-filter" className="w-full md:w-[300px]">
                <SelectValue placeholder={isLoadingProperties ? "Loading..." : "Select a property to view expenses"} />
              </SelectTrigger>
              <SelectContent>
                {properties?.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead className="text-right">Amount (£)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingExpenses && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
                {!isLoadingExpenses && expenses?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      {selectedProperty
                        ? 'No expenses logged for this property.'
                        : 'Select a property to see expenses.'}
                    </TableCell>
                  </TableRow>
                )}
                {expenses?.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      {format(
                        expense.date instanceof Date
                          ? expense.date
                          : new Date(expense.date.seconds * 1000),
                        'dd/MM/yyyy'
                      )}
                    </TableCell>
                    <TableCell>{expense.expenseType}</TableCell>
                    <TableCell>{expense.paidBy}</TableCell>
                    <TableCell className="text-right font-medium">
                      {expense.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end font-bold">
          <div className="flex items-center gap-4">
            <span>Total for Selected Property:</span>
            <span>£{totalExpenses.toFixed(2)}</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
