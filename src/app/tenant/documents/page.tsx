
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Loader2, 
  ShieldCheck, 
  Upload,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit, onSnapshot, collection } from 'firebase/firestore';
import { isBefore } from 'date-fns';

interface DocumentRecord {
    id: string;
    title: string;
    documentType: string;
    fileUrl?: string;
    expiryDate: any;
    issueDate: any;
}

export default function TenantDocumentsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;

    if (!user || !firestore || !user.email) {
      setIsLoadingContext(false);
      return;
    }
    
    const userEmail = user.email.toLowerCase().trim();

    const q = query(
        collectionGroup(firestore, 'tenants'), 
        where('email', '==', userEmail),
        limit(5)
    );

    const unsub = onSnapshot(q, (snap) => {
        const activeTenant = snap.docs.find(d => d.data().status === 'Active');
        if (activeTenant) {
            const data = activeTenant.data();
            setTenantContext({ 
                landlordId: data.landlordId, 
                propertyId: data.propertyId 
            });
        }
        setIsLoadingContext(false);
    }, (error) => {
        console.warn("Tenant documents portal discovery issue:", error.message);
        setIsLoadingContext(false);
    });

    return () => unsub();
  }, [user, isUserLoading, firestore]);

  const docsQuery = useMemoFirebase(() => {
    if (!tenantContext || !user || !firestore) return null;
    return query(
        collection(firestore, 'documents'),
        where('propertyId', '==', tenantContext.propertyId),
        limit(50)
    );
  }, [tenantContext, user, firestore]);

  const { data: documents, isLoading: isLoadingDocs } = useCollection<DocumentRecord>(docsQuery);

  const getStatus = (expiry: any) => {
    if (!expiry) return 'Valid';
    const date = expiry instanceof Date ? expiry : new Date(expiry.seconds * 1000);
    return isBefore(date, new Date()) ? 'Expired' : 'Valid';
  };

  if (isLoadingContext || isUserLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Portal Files...</p>
      </div>
    );
  }

  if (!tenantContext) {
    return (
      <Card className="max-w-md mx-auto mt-10 shadow-lg border-none text-center">
        <CardHeader className="bg-muted/20 pb-8">
          <div className="bg-background p-4 rounded-full w-fit mx-auto mb-4 border shadow-sm">
              <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-lg">Portal Access Restricted</CardTitle>
          <CardDescription>We could not find an active tenancy associated with this account. Please contact your landlord.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Button variant="outline" className="w-full font-bold h-11" asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Compliance & Documents</h1>
        <p className="text-muted-foreground font-medium">Access your signed agreements, safety certificates, and property reports.</p>
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
                            <ShieldCheck className="h-4 w-4 text-primary opacity-40" />
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
                            <Badge variant="outline" className="w-full justify-center h-10 border-dashed opacity-50">Record Only</Badge>
                        )}
                    </CardContent>
                </Card>
            ))
        )}
      </div>

      <Card className="bg-muted/20 border-dashed border-2">
        <CardContent className="p-10 text-center">
            <Upload className="h-10 w-10 text-primary/20 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Upload Shared Evidence</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">Need to send your landlord proof of payment or a signed notice? Use your main dashboard upload tool or contact your landlord via secure messages.</p>
            <Button variant="outline" className="font-bold h-11 px-8 border-primary/20 hover:bg-primary/5" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
