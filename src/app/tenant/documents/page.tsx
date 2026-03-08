
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Eye, 
  Loader2, 
  ShieldCheck, 
  Clock,
  ExternalLink,
  Upload
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit, onSnapshot, collection } from 'firebase/firestore';
import { format, isBefore } from 'date-fns';

interface DocumentRecord {
    id: string;
    title: string;
    documentType: string;
    fileUrl?: string;
    expiryDate: any;
    issueDate: any;
}

export default function TenantDocumentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  useEffect(() => {
    if (!user || !firestore) return;
    const q = query(collectionGroup(firestore, 'tenants'), where('email', '==', user.email?.toLowerCase()), limit(1));
    const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
            const doc = snap.docs[0];
            const path = doc.ref.path.split('/');
            setTenantContext({ landlordId: path[1], propertyId: path[3] });
        }
        setIsLoadingContext(false);
    });
    return () => unsub();
  }, [user, firestore]);

  const docsQuery = useMemoFirebase(() => {
    if (!tenantContext || !user || !firestore) return null;
    return query(
        collection(firestore, 'userProfiles', tenantContext.landlordId, 'properties', tenantContext.propertyId, 'documents'),
        limit(50)
    );
  }, [tenantContext, user, firestore]);

  const { data: documents, isLoading: isLoadingDocs } = useCollection<DocumentRecord>(docsQuery);

  const getStatus = (expiry: any) => {
    if (!expiry) return 'Valid';
    const date = expiry instanceof Date ? expiry : new Date(expiry.seconds * 1000);
    return isBefore(date, new Date()) ? 'Expired' : 'Valid';
  };

  if (isLoadingContext) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Compliance & Documents</h1>
        <p className="text-muted-foreground font-medium">Access your signed agreements, gas safety certs, and EPC reports.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoadingDocs ? (
            <div className="col-span-full py-20 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
        ) : !documents?.length ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-muted/5">
                <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold">No documents shared yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Your landlord will upload certificates and agreements here.</p>
            </div>
        ) : (
            documents.map((doc) => (
                <Card key={doc.id} className="shadow-lg border-none overflow-hidden hover:scale-[1.02] transition-all">
                    <CardHeader className="bg-primary/5 pb-4">
                        <div className="flex items-center justify-between mb-2">
                            <Badge variant={getStatus(doc.expiryDate) === 'Valid' ? 'default' : 'destructive'} className="text-[9px] uppercase font-bold px-2 py-0">
                                {getStatus(doc.expiryDate)}
                            </Badge>
                            <FileText className="h-4 w-4 text-primary opacity-40" />
                        </div>
                        <CardTitle className="text-base font-bold leading-tight line-clamp-2">{doc.title}</CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold tracking-widest">{doc.documentType}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        {doc.fileUrl ? (
                            <Button className="w-full h-10 font-bold uppercase tracking-widest text-[10px] shadow-md" asChild>
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <Download className="mr-2 h-3.5 w-3.5" /> Download File
                                </a>
                            </Button>
                        ) : (
                            <Badge variant="outline" className="w-full justify-center h-10 border-dashed opacity-50">Archive Record Only</Badge>
                        )}
                    </CardContent>
                </Card>
            ))
        )}
      </div>

      <Card className="bg-muted/20 border-dashed border-2">
        <CardContent className="p-10 text-center">
            <Upload className="h-10 w-10 text-primary/20 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Upload Evidence</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">Need to send your landlord proof of payment, insurance, or a signed notice? Upload it securely to your folder.</p>
            <Button variant="outline" className="font-bold h-11 px-8 border-primary/20 hover:bg-primary/5" asChild>
                <Link href="/tenant/documents/upload">Start Secure Upload</Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
