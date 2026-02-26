'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  PlusCircle,
  Loader2,
  Edit,
  Archive,
  Search,
  MoreVertical,
  Mail,
  Phone,
  HardHat,
  Eye,
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Types
interface Contractor {
  id: string;
  name: string;
  trade: string;
  phone: string;
  email?: string;
  ownerId: string;
  status?: string;
}

export default function ContractorsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [contractorToArchive, setContractorToArchive] = useState<Contractor | null>(null);

  // Fetch contractors nested under user profile
  const contractorsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'contractors'),
      where('ownerId', '==', user.uid),
      where('status', '==', 'Active')
    );
  }, [firestore, user]);
  const { data: contractors, isLoading, error } = useCollection<Contractor>(contractorsQuery);

  const filteredContractors = useMemo(() => {
    if (!contractors) return [];
    if (!searchTerm) return contractors;
    return contractors.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.trade.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [contractors, searchTerm]);
  
  const handleArchiveConfirm = async () => {
    if (!firestore || !contractorToArchive || !user) return;
    try {
      const ref = doc(firestore, 'userProfiles', user.uid, 'contractors', contractorToArchive.id);
      await updateDoc(ref, { status: 'Archived' });
      toast({
        title: 'Contractor Archived',
        description: `${contractorToArchive.name} has been moved to the archives.`,
      });
    } catch (e) {
      console.error('Error archiving contractor:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not archive the contractor.' });
    } finally {
      setContractorToArchive(null);
    }
  };


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Contractors</h1>
            <p className="text-muted-foreground">Manage your directory of trusted tradespeople.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/dashboard/contractors/archived"><Archive className="mr-2 h-4 w-4" /> View Archived</Link>
              </Button>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/contractors/add"><PlusCircle className="mr-2 h-4 w-4" /> Add Contractor</Link>
              </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Contractor Directory</CardTitle>
            <CardDescription>Your list of saved contractors.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full max-w-sm mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name or trade..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            {isLoading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : error ? (
              <div className="text-center py-10 text-destructive">Error: {error.message}</div>
            ) : !filteredContractors?.length ? (
              <div className="text-center py-10 text-muted-foreground">{searchTerm ? `No contractors found for "${searchTerm}".` : 'No active contractors found.'}</div>
            ) : (
              <>
                <div className="hidden rounded-md border md:block">
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Trade</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filteredContractors.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium"><Link href={`/dashboard/contractors/${c.id}`} className="hover:underline">{c.name}</Link></TableCell>
                          <TableCell>{c.trade}</TableCell>
                          <TableCell>{c.phone}</TableCell>
                          <TableCell>{c.email}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/contractors/${c.id}`}><Eye className="h-4 w-4" /></Link></Button>
                            <Button asChild variant="ghost" size="icon"><Link href={`/dashboard/contractors/${c.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                            <Button variant="ghost" size="icon" onClick={() => setContractorToArchive(c)}><Archive className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-4 md:hidden">
                  {filteredContractors.map((c) => (
                    <Card key={c.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base"><Link href={`/dashboard/contractors/${c.id}`} className="hover:underline">{c.name}</Link></CardTitle>
                            <CardDescription>{c.trade}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild><Link href={`/dashboard/contractors/${c.id}`}><Eye className="mr-2 h-4 w-4" /> View</Link></DropdownMenuItem>
                              <DropdownMenuItem asChild><Link href={`/dashboard/contractors/${c.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setContractorToArchive(c)} className="text-destructive">Archive</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{c.phone}</span></div>
                        {c.email && (<div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className='truncate'>{c.email}</span></div>)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={!!contractorToArchive} onOpenChange={(open) => !open && setContractorToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will archive {contractorToArchive?.name}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleArchiveConfirm}>Archive</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
