import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Upload, FileWarning, Clock, ShieldCheck } from 'lucide-react';
import { documents } from '@/data/mock-data';

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'Expired':
      return 'destructive';
    case 'Expiring Soon':
      return 'secondary';
    default:
      return 'outline';
  }
};

export default function DocumentsPage() {
  const expiredCount = documents.filter(d => d.status === 'Expired').length;
  const expiringSoonCount = documents.filter(d => d.status === 'Expiring Soon').length;
  const validCount = documents.filter(d => d.status === 'Valid').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Expired Documents</CardTitle>
               <FileWarning className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-destructive">{expiredCount}</div>
               <p className="text-xs text-muted-foreground">Needs immediate attention</p>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
               <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">{expiringSoonCount}</div>
               <p className="text-xs text-muted-foreground">Action required within 90 days</p>
            </CardContent>
         </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-sm font-medium">Valid Documents</CardTitle>
               <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold">{validCount}</div>
               <p className="text-xs text-muted-foreground">All documents up to date</p>
            </CardContent>
         </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
          <CardDescription>
            Manage all your property-related documents in one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Button asChild className='w-full md:w-auto'>
              <Link href="/dashboard/documents/upload">
                <Upload className="mr-2 h-4 w-4" /> Upload Document
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by title or property..." className="pl-8" />
            </div>
            <div className="flex gap-2 flex-wrap">
               <Select>
                  <SelectTrigger className="w-full md:w-[180px]">
                     <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                        'Tenancy Agreement', 'Inventory', 'Gas Safety Certificate', 'Electrical Certificate', 'EPC', 'Insurance', 'Deposit Protection', 'Licence', 'Correspondence', 'Invoice'
                    ].map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
               </Select>
               <Select>
                  <SelectTrigger className="w-full md:w-[180px]">
                     <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="All">All Documents</SelectItem>
                     <SelectItem value="Expired">Expired</SelectItem>
                     <SelectItem value="Expiring Soon">Expiring Soon</SelectItem>
                     <SelectItem value="Valid">Valid</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Expiry Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{doc.property}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(doc.status)}>{doc.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{doc.expiryDate}</TableCell>
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
