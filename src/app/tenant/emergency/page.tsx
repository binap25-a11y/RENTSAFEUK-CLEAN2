'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, getDoc, onSnapshot, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldAlert, 
  Loader2, 
  Phone, 
  Mail, 
  Flame, 
  Zap, 
  Ambulance, 
  AlertTriangle,
  Info,
  ChevronRight,
  Download,
  Home,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { generateEmergencyPDF } from '@/lib/generate-emergency-pdf';
import { cn } from '@/lib/utils';

/**
 * @fileOverview Resident Emergency Information Page
 * Provides critical safety instructions and contact details for the tenant's specific property.
 * STEP 1 protocols are hardcoded for UK compliance.
 */

export default function TenantEmergencyPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [propertyData, setPropertyData] = useState<any>(null);
  const [emergencyData, setEmergencyInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isUserLoading || !user || !firestore || !user.email) {
      if (!user && !isUserLoading) setIsLoading(false);
      return;
    }
    
    const userEmail = user.email.toLowerCase().trim();
    const tenantsCol = collection(firestore, 'tenants');
    const q = query(tenantsCol, where('email', '==', userEmail), limit(1));

    const unsub = onSnapshot(q, async (snap) => {
        if (!snap.empty) {
            const tData = snap.docs[0].data();
            const pId = tData.propertyId;
            
            setTenantContext({ ...tData, id: snap.docs[0].id });

            // Fetch property details for full address
            const propRef = doc(firestore, 'properties', pId);
            const propSnap = await getDoc(propRef);
            if (propSnap.exists()) {
                setPropertyData(propSnap.data());
            }

            // Fetch emergency config for this specific property
            const configRef = doc(firestore, 'emergencyInfo', pId);
            getDoc(configRef)
                .then(configSnap => {
                    if (configSnap.exists()) {
                        setEmergencyInfo(configSnap.data());
                    }
                })
                .catch(async (err) => {
                    if (err.code === 'permission-denied') {
                        const permissionError = new FirestorePermissionError({
                            path: configRef.path,
                            operation: 'get'
                        });
                        errorEmitter.emit('permission-error', permissionError);
                    }
                });
        }
        setIsLoading(false);
    }, async (error) => {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: 'tenants',
                operation: 'list'
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        setIsLoading(false);
    });

    return () => unsub();
  }, [user, isUserLoading, firestore]);

  const propertyAddress = propertyData ? [
    propertyData.address?.nameOrNumber,
    propertyData.address?.street,
    propertyData.address?.city,
    propertyData.address?.postcode
  ].filter(Boolean).join(', ') : 'Assigned Property';

  const handleExport = async () => {
    if (!emergencyData || !tenantContext) return;
    setIsExporting(true);
    await generateEmergencyPDF(emergencyData, propertyAddress);
    setIsExporting(false);
  };

  if (isLoading || isUserLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Scanning Safety Protocols...</p>
      </div>
    );
  }

  if (!tenantContext) {
    return (
      <Card className="max-w-md mx-auto mt-10 shadow-lg border-none text-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive/20 mx-auto mb-4" />
        <p className="font-bold">Portal Sync Required</p>
        <p className="text-sm text-muted-foreground mt-1">Please verify your tenancy with your landlord to access emergency procedures.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 text-left animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl font-bold font-headline text-destructive flex items-center gap-3">
            <ShieldAlert className="h-8 w-8" /> Emergency Information
          </h1>
          <p className="text-muted-foreground font-medium text-lg ml-1 flex items-center gap-2 text-left">
            <Home className="h-4 w-4 opacity-40" />
            {propertyAddress}
          </p>
        </div>
        <Button variant="outline" className="font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2 bg-background shadow-md border-primary/20" onClick={handleExport} disabled={isExporting || !emergencyData}>
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
            Download Safety PDF
        </Button>
      </div>

      {/* STEP 1: IMMEDIATE DANGER */}
      <Card className="border-none shadow-2xl overflow-hidden ring-4 ring-destructive/10 text-left">
        <CardHeader className="bg-destructive text-white pb-6 text-center">
          <CardTitle className="text-2xl font-headline tracking-tight uppercase">STEP 1 – IMMEDIATE DANGER (ACT FIRST)</CardTitle>
          <CardDescription className="text-white/80 font-medium italic">In any situation involving risk to life or serious safety, contact emergency services first.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 p-6">
            <a href="tel:0800111999" className="flex flex-col items-center justify-center p-6 rounded-[2rem] bg-orange-50 border-2 border-orange-100 hover:scale-[1.02] transition-transform text-center group">
                <div className="p-4 rounded-full bg-orange-100 text-orange-600 mb-3 group-hover:bg-orange-600 group-hover:text-white transition-colors"><Flame className="h-8 w-8" /></div>
                <p className="text-sm font-black uppercase text-orange-800 leading-tight">Gas Leak</p>
                <p className="text-xs font-bold text-orange-600 mt-1">0800 111 999</p>
            </a>
            <a href="tel:105" className="flex flex-col items-center justify-center p-6 rounded-[2rem] bg-blue-50 border-2 border-blue-100 hover:scale-[1.02] transition-transform text-center group">
                <div className="p-4 rounded-full bg-blue-100 text-blue-600 mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Zap className="h-8 w-8" /></div>
                <p className="text-sm font-black uppercase text-blue-800 leading-tight">Electric Emergency</p>
                <p className="text-xs font-bold text-blue-600 mt-1">Call 105</p>
            </a>
            <a href="tel:999" className="flex flex-col items-center justify-center p-6 rounded-[2rem] bg-destructive/5 border-2 border-destructive/10 hover:scale-[1.02] transition-transform text-center group">
                <div className="p-4 rounded-full bg-destructive/10 text-destructive mb-3 group-hover:bg-destructive group-hover:text-white transition-colors"><Ambulance className="h-8 w-8" /></div>
                <p className="text-sm font-black uppercase text-destructive leading-tight">Emergency Services</p>
                <p className="text-xs font-bold text-destructive mt-1">Call 999</p>
            </a>
        </CardContent>
        <CardFooter className="bg-destructive/5 p-4 border-t border-destructive/10 justify-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive">Do NOT contact the landlord first in these situations.</p>
        </CardFooter>
      </Card>

      {/* STEP 2: URGENT PROPERTY EMERGENCIES */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-lg border-none overflow-hidden text-left">
            <CardHeader className="bg-orange-500 text-white pb-6">
                <CardTitle className="text-lg font-headline uppercase flex items-center gap-2">
                    <Phone className="h-5 w-5" /> 🟠 STEP 2 – URGENT PROPERTY EMERGENCIES (24/7)
                </CardTitle>
                <CardDescription className="text-white/80">Issues affecting basic survival or property security.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="p-5 rounded-2xl bg-muted/20 border-2 border-dashed text-left overflow-hidden">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Emergency Repair Contact</p>
                    <p className="text-lg font-bold break-words leading-tight">{emergencyData?.emergencyRepairContact || 'Property Support Team'}</p>
                    <a href={`tel:${emergencyData?.emergencyRepairPhone}`} className="text-xl font-black text-primary hover:underline block mt-2 tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                        {emergencyData?.emergencyRepairPhone || 'N/A'}
                    </a>
                </div>
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Urgency Examples:</p>
                    <ul className="grid grid-cols-1 gap-2">
                        {['Burst pipes / major water leaks', 'Total loss of electricity (internal issue)', 'No heating or hot water (especially in winter)', 'Broken doors/windows affecting security.'].map(item => (
                            <li key={item} className="flex items-center gap-2 text-xs font-bold text-foreground">
                                <ChevronRight className="h-3.5 w-3.5 text-orange-500" /> {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-lg border-none overflow-hidden text-left">
            <CardHeader className="bg-green-600 text-white pb-6">
                <CardTitle className="text-lg font-headline uppercase flex items-center gap-2">
                    <Clock className="h-5 w-5" /> 🟢 NON-EMERGENCY REPAIRS
                </CardTitle>
                <CardDescription className="text-white/80">Routine maintenance during working hours.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
                <div className="grid gap-4">
                    <div className="p-4 rounded-xl bg-muted/20 flex items-center gap-4 text-left">
                        <div className="p-2.5 rounded-full bg-green-100 text-green-600 shrink-0"><Phone className="h-4 w-4" /></div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Contact Phone Number</p>
                            <p className="font-bold text-sm break-all">{emergencyData?.nonEmergencyPhone || 'N/A'}</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/20 flex items-center gap-4 text-left">
                        <div className="p-2.5 rounded-full bg-green-100 text-green-600 shrink-0"><Mail className="h-4 w-4" /></div>
                        <div className="min-w-0 overflow-hidden">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Reporting Email</p>
                            <p className="font-bold text-sm truncate">{emergencyData?.nonEmergencyEmail || 'N/A'}</p>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">Routine Items:</p>
                    <ul className="grid grid-cols-1 gap-2">
                        {['Dripping taps', 'Minor repairs', 'General maintenance'].map(item => (
                            <li key={item} className="flex items-center gap-2 text-xs font-bold text-foreground">
                                <ChevronRight className="h-3.5 w-3.5 text-green-600" /> {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
          <Card className="shadow-md border-none overflow-hidden bg-primary/5 text-left">
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-primary">💧 WATER EMERGENCY</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                      Contact your local water supplier. Emergency contact details are available on your latest water supply bill.
                  </p>
              </CardContent>
          </Card>
          <Card className="shadow-md border-none overflow-hidden bg-primary/5 text-left">
              <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-primary">🏛️ LOCAL AUTHORITY (SERIOUS ISSUES)</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground">
                      {emergencyData?.localAuthorityInfo || 'If required, contact your local authority for serious property health and safety issues.'}
                  </p>
              </CardContent>
          </Card>
      </div>

      <Card className="border-none shadow-sm bg-muted/10 text-left">
          <CardContent className="p-6 flex items-start gap-4 text-left">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1 text-left">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Management Record</p>
                  <p className="text-xs font-medium text-muted-foreground">
                      Landlord: <strong>{emergencyData?.landlordName || 'Verified Management'}</strong> • Email: <strong>{emergencyData?.landlordEmail || 'On Registry'}</strong>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">Correspondence: {emergencyData?.landlordAddress || 'Refer to registry'}</p>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
