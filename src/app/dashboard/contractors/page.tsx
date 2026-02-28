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

  // Fetch contractors nested under user profile - strictly hierarchical.
  const contractorsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'userProfiles', user.uid, 'contractors'),
      where('status', '==', 'Active')
    );
  }, [firestore, user]);
  const { data: contractors, isLoading, error } = useCollection<Contractor>(contractorsQuery);

  const filteredContractors = useMemo(() => {
    if (!contractors) return [];
    if (!searchTerm) return contractors;
    const lower = searchTerm.toLowerCase();
    return contractors.filter(c =>
        c.name.toLowerCase().includes(lower) ||
        c.trade.toLowerCase().includes(lower)
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
      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Contractors</h1>
          <p className="text-muted-foreground font-medium text-lg">Manage your directory of trusted tradespeople.</p>
        </div>
        
        <Card className="border-none shadow-xl overflow-hidden">
          {/* Card Header with Search */}
          <CardHeader className="bg-muted/30 border-b pb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Contractor Directory</CardTitle>
                <CardDescription>Your list of saved contractors.</CardDescription>
              </div>
              <div className="relative w-full md:w-auto md:max-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name or trade..." 
                  className="pl-8 h-10 bg-background" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-64 gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Loading directory...</p>
              </div>
            ) : error ? (
              <div className="text-center py-10 text-destructive font-medium border border-destructive/20 rounded-lg bg-destructive/5">
                Error loading contractors: {error.message}
              </div>
            ) : !filteredContractors?.length ? (
              <div className="text-center py-24 border-2 border-dashed rounded-2xl bg-muted/5">
                 <div className="bg-background p-4 rounded-full shadow-sm w-fit mx-auto mb-4">
                    <HardHat className="w-10 h-10 text-muted-foreground opacity-20" />
                 </div>
                 <h3 className="text-xl font-bold">{searchTerm ? 'No matches found' : 'Your directory is empty'}</h3>
                <p className="text-muted-foreground mb-6 mt-1 max-w-sm mx-auto">
                  {searchTerm ? `Try a different search term.` : 'Add your first contractor to keep their contact details within reach.'}
                </p>
                {!searchTerm && (
                  <Button asChild size="lg" className="font-bold px-8 shadow-md">
                    <Link href="/dashboard/contractors/add">
                        <PlusCircle className="mr-2 h-5 w-5" /> Add First Contractor
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden rounded-md border md:block overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Name</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Trade</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase tracking-wider">Contact</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase tracking-wider pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredContractors.map((c) => (
                        <TableRow key={c.id} className="hover:bg-muted/30 transition-colors group">
                          <TableCell className="font-bold py-4">
                            <Link href={`/dashboard/contractors/${c.id}`} className="hover:underline text-primary">{c.name}</Link>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">
                            {c.trade}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                                <p className="text-xs font-semibold">{c.phone}</p>
                                {c.email && <p className="text-[10px] text-muted-foreground">{c.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="View Details"><Link href={`/dashboard/contractors/${c.id}`}><Eye className="h-4 w-4" /></Link></Button>
                              <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Edit Record"><Link href={`/dashboard/contractors/${c.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Archive" onClick={() => setContractorToArchive(c)}><Archive className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-4 md:hidden">
                  {filteredContractors.map((c) => (
                    <Card key={c.id} className="shadow-sm border-muted/60">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-bold"><Link href={`/dashboard/contractors/${c.id}`} className="hover:underline">{c.name}</Link></CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-tight mt-1 text-primary">{c.trade}</CardDescription>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-2 -mt-2"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild><Link href={`/dashboard/contractors/${c.id}`}><Eye className="mr-2 h-4 w-4" /> View Details</Link></DropdownMenuItem>
                              <DropdownMenuItem asChild><Link href={`/dashboard/contractors/${c.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link></DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setContractorToArchive(c)} className="text-destructive">Archive Contractor</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm pt-0 pb-4 border-b border-dashed">
                        <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><span>{c.phone}</span></div>
                        {c.email && (<div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className='truncate'>{c.email}</span></div>)}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons Container - Repositioned below the main directory card */}
        <div className="flex items-center gap-3 w-full px-1">
            <Button asChild variant="outline" className="flex-1 font-bold shadow-sm h-11 px-6 border-primary/20 hover:bg-primary/5 transition-all">
                <Link href="/dashboard/contractors/archived">
                    <Archive className="mr-2 h-4 w-4 text-primary" /> View Archived
                </Link>
            </Button>
            <Button asChild className="flex-1 font-bold shadow-lg h-11 px-8 bg-primary hover:bg-primary/90 transition-all">
              <Link href="/dashboard/contractors/add">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Contractor
              </Link>
            </Button>
        </div>
      </div>

      <AlertDialog open={!!contractorToArchive} onOpenChange={(open) => !open && setContractorToArchive(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Archive Contractor?</AlertDialogTitle>
            <AlertDialogDescription className="text-base font-medium">
              This will move the record for <strong className="text-foreground">{contractorToArchive?.name}</strong> to your archived directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-4">
            <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-xs h-11">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold uppercase tracking-widest text-xs h-11 px-8 shadow-lg" 
              onClick={handleArchiveConfirm}
            >
              Archive Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
