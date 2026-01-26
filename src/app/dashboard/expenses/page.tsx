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
import { CalendarIcon, Clock, DollarSign, TrendingDown, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, getYear } from 'date-fns';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// TYPE DEFINITIONS

// Main interface for a Property document from Firestore
interface Property {
  id: string;
  address: string;
  tenancy?: {
    monthlyRent: number;
  };
}

// Type for expense documents from Firestore
interface Expense {
  id:string;
  propertyId: string;
  date: { seconds: number; nanoseconds: number } | Date;
  expenseType: string;
  amount: number;
  paidBy: string;
  notes?: string;
}

// Schema for the expense form
const expenseSchema = z.object({
  propertyId: z.string({ required_error: 'Please select a property.' }),
  date: z.date({ required_error: 'Please select a date.' }),
  expenseType: z.string({ required_error: 'Please select an expense type.' }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  paidBy: z.string().min(1, 'This field is required.'),
  notes: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;


// MAIN COMPONENT
export default function FinancialsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  // Fetch all properties for the user
  const propertiesQuery = useMemoFirebase(() => {
    if (!user) return null;
    return query(
      collection(firestore, 'properties'),
      where('ownerId', '==', user.uid),
       where('status', 'in', ['Vacant', 'Occupied', 'Under Maintenance'])
    );
  }, [firestore, user]);

  const { data: properties, isLoading: isLoadingProperties } = useCollection<Property>(propertiesQuery);
  
  const selectedProperty = useMemo(() => {
    return properties?.find(p => p.id === selectedPropertyId);
  }, [properties, selectedPropertyId]);


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Financials</h1>
        <p className="text-muted-foreground">
          Track expenses, view annual summaries, and manage rent statements.
        </p>
      </div>

       <Card>
        <CardHeader>
           <div className='flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center'>
            <div>
              <CardTitle>Financial Overview</CardTitle>
              <CardDescription>Select a property to view its detailed financials.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Label htmlFor="property-filter" className='sr-only'>Property</Label>
              <Select onValueChange={setSelectedPropertyId} value={selectedPropertyId}>
                <SelectTrigger id="property-filter" className="w-full sm:w-[300px]">
                  <SelectValue placeholder={isLoadingProperties ? "Loading..." : "Select a property"} />
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
          </div>
        </CardHeader>
        <CardContent>
           <Tabs defaultValue="expenses">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="summary">Annual Summary</TabsTrigger>
                <TabsTrigger value="statement">Rent Statement</TabsTrigger>
              </TabsList>
              <TabsContent value="expenses">
                <ExpenseTracker 
                  properties={properties || []} 
                  selectedPropertyId={selectedPropertyId} 
                  isLoadingProperties={isLoadingProperties}
                />
              </TabsContent>
              <TabsContent value="summary">
                <AnnualSummary allProperties={properties || []} selectedProperty={selectedProperty} />
              </TabsContent>
              <TabsContent value="statement">
                <RentStatement selectedProperty={selectedProperty} />
              </TabsContent>
            </Tabs>
        </CardContent>
       </Card>

    </div>
  );
}


// EXPENSE TRACKER COMPONENT
function ExpenseTracker({ properties, selectedPropertyId, isLoadingProperties }: { properties: Property[], selectedPropertyId: string, isLoadingProperties: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date(),
      propertyId: selectedPropertyId || undefined,
    },
  });

  // Automatically update the form's propertyId when the global selection changes
  useMemo(() => {
    form.setValue('propertyId', selectedPropertyId);
  }, [selectedPropertyId, form]);

  // Fetch expenses for the selected property
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedPropertyId) return null;
    return query(
      collection(firestore, 'properties', selectedPropertyId, 'expenses'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedPropertyId]);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  // Handle form submission
  async function onSubmit(data: ExpenseFormValues) {
    if (!user || !firestore) return;

    const newExpense = { ...data, ownerId: user.uid };

    try {
      const expensesCollection = collection(firestore, 'properties', data.propertyId, 'expenses');
      await addDocumentNonBlocking(expensesCollection, newExpense);
      toast({
        title: 'Expense Logged',
        description: 'The new expense has been successfully logged.',
      });
      form.reset({ ...form.getValues(), expenseType: '', amount: undefined, notes: '' });
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
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader><CardTitle>Log New Expense</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control} name="propertyId"
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
                          <SelectItem key={prop.id} value={prop.id}>{prop.address}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control} name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={'outline'} className={cn('pl-3 text-left font-normal',!field.value && 'text-muted-foreground')}>
                              {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control} name="expenseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expense Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {['Repairs and Maintenance','Utilities','Insurance','Mortgage Interest','Cleaning','Gardening','Letting Agent Fees',].map((type) => (
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
                  control={form.control} name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (£)</FormLabel>
                      <FormControl><Input type="number" placeholder="100.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control} name="paidBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paid By</FormLabel>
                      <FormControl><Input placeholder="e.g., Landlord, Tenant" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control} name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea placeholder="Add any relevant notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end"><Button type="submit">Log Expense</Button></div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logged Expenses</CardTitle>
          <CardDescription>Expenses logged for the selected property.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Paid By</TableHead><TableHead className="text-right">Amount (£)</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoadingExpenses && (<TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>)}
                {!isLoadingExpenses && expenses?.length === 0 && (<TableRow><TableCell colSpan={4} className="h-24 text-center">{selectedPropertyId ? 'No expenses logged for this property.' : 'Select a property to see expenses.'}</TableCell></TableRow>)}
                {expenses?.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{format(expense.date instanceof Date ? expense.date : new Date(expense.date.seconds * 1000),'dd/MM/yyyy')}</TableCell>
                    <TableCell>{expense.expenseType}</TableCell>
                    <TableCell>{expense.paidBy}</TableCell>
                    <TableCell className="text-right font-medium">{expense.amount.toFixed(2)}</TableCell>
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


// ANNUAL SUMMARY COMPONENT
function AnnualSummary({ allProperties, selectedProperty }: { allProperties: Property[], selectedProperty: Property | undefined }) {
  const { user } = useUser();
  const firestore = useFirestore();

  // Fetch expenses for the selected property
  const expensesQuery = useMemoFirebase(() => {
    if (!user || !firestore || !selectedProperty) return null;
    return query(
      collection(firestore, 'properties', selectedProperty.id, 'expenses'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user, selectedProperty]);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);
  
  const portfolioIncome = useMemo(() => {
    return allProperties.reduce((total, prop) => {
        return total + (prop.tenancy?.monthlyRent || 0) * 12;
    }, 0);
  }, [allProperties]);

  const selectedPropertyIncome = (selectedProperty?.tenancy?.monthlyRent || 0) * 12;
  
  const selectedPropertyExpenses = useMemo(() => {
    return expenses?.reduce((total, exp) => total + exp.amount, 0) || 0;
  }, [expenses]);
  
  const selectedPropertyNet = selectedPropertyIncome - selectedPropertyExpenses;

  const expensesByCategory = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};
    expenses?.forEach(exp => {
      categoryMap[exp.expenseType] = (categoryMap[exp.expenseType] || 0) + exp.amount;
    });
    return Object.entries(categoryMap).map(([name, amount]) => ({ name, amount }));
  }, [expenses]);


  return (
    <div className="space-y-6 mt-6">
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Portfolio Income (Annual)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">£{portfolioIncome.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                <p className="text-xs text-muted-foreground">Across {allProperties.length} properties</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Selected Property Expenses (Annual)</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {isLoadingExpenses ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className="text-2xl font-bold">£{selectedPropertyExpenses.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>}
                    <p className="text-xs text-muted-foreground">{selectedProperty ? selectedProperty.address : 'No property selected'}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Selected Property Net Income (Annual)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                     {isLoadingExpenses ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className={cn("text-2xl font-bold", selectedPropertyNet < 0 && "text-destructive")}>£{selectedPropertyNet.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>}
                    <p className="text-xs text-muted-foreground">Based on potential rent vs logged expenses</p>
                </CardContent>
            </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Expense Breakdown by Category</CardTitle>
                <CardDescription>For {selectedProperty ? selectedProperty.address : 'the selected property'} for all time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingExpenses && <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin" /></TableCell></TableRow>}
                    {!isLoadingExpenses && expensesByCategory.length === 0 && <TableRow><TableCell colSpan={2} className="h-24 text-center">{selectedProperty ? "No expenses found." : "Please select a property."}</TableCell></TableRow>}
                    {expensesByCategory.map(cat => (
                      <TableRow key={cat.name}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-right">£{cat.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
        </Card>
    </div>
  );
}


// RENT STATEMENT COMPONENT
function RentStatement({ selectedProperty }: { selectedProperty: Property | undefined }) {
  const currentYear = getYear(new Date());

  const statement = useMemo(() => {
    if (!selectedProperty?.tenancy?.monthlyRent) return [];
    
    const rent = selectedProperty.tenancy.monthlyRent;
    const months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(currentYear, i, 1);
      return format(date, 'MMMM');
    });

    return months.map(month => ({
      month,
      rent,
      paid: false, // This is static as we don't track payments yet
      notes: 'Payment tracking not implemented'
    }));
  }, [selectedProperty, currentYear]);

  const totalRent = (selectedProperty?.tenancy?.monthlyRent || 0) * 12;

  if (!selectedProperty) {
    return (
        <Card className="mt-6">
            <CardContent className='pt-6'>
                <p className="text-center text-muted-foreground">Please select a property to view its rent statement.</p>
            </CardContent>
        </Card>
    )
  }

  if (!selectedProperty.tenancy?.monthlyRent) {
     return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Rent Payment Statement</CardTitle>
                <CardDescription>For {selectedProperty.address}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-center text-muted-foreground">No tenancy or rent information available for this property.</p>
            </CardContent>
        </Card>
    )
  }


  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Rent Payment Statement</CardTitle>
        <CardDescription>Expected monthly rent payments for {selectedProperty.address} for {currentYear}.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Expected Rent</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {statement.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell>£{row.rent.toFixed(2)}</TableCell>
                  <TableCell><span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Pending</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
       <CardFooter className='flex justify-end font-bold text-lg'>
          Total Expected Annual Rent: £{totalRent.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
      </CardFooter>
    </Card>
  );
}

    