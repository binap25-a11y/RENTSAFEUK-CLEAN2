'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, getDoc, setDoc, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShieldAlert, 
  Loader2, 
  Download, 
  CheckCircle2, 
  MapPin, 
  Building2, 
  Phone, 
  Mail, 
  Save,
  Search,
  ChevronRight,
  AlertTriangle,
  Clock,
  Flame,
  Zap,
  Ambulance
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generateEmergencyPDF } from '@/lib/generate-emergency-pdf';
import { cn } from '@/lib/utils';

interface Property {
  id: string;
  address: {
    nameOrNumber?: string;
    street: string;
    city: string;
    postcode: string;
  };
  status: string;
}

interface EmergencyInfo {
    landlordName: string;
    landlordAddress: string;
    landlordPhone: string;
    landlordEmail: string;
    emergencyRepairContact: string;
    emergencyRepairPhone: string;
    nonEmergencyPhone: string;
    nonEmergencyEmail: string;
    localAuthorityInfo: string;
}

export default function LandlordEmergencyConfigPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [formData, setFormData] = useState<EmergencyInfo>({
    landlordName: '',
    landlordAddress: '',
    landlordPhone: '',
    landlordEmail: '',
    emergencyRepairContact: '',
    emergencyRepairPhone: '',
    nonEmergencyPhone: '',
    nonEmergencyEmail: '',
    localAuthorityInfo: ''
  });

  const propertiesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'properties'),
        where('landlordId', '==', user.uid),
        where('status', 'in', ['Occupied', 'Vacant', 'Under Maintenance']),
        limit(500)
    );
  }, [user, firestore]);

  const { data: properties, isLoading: isLoadingProps } = useCollection<Property>(propertiesQuery);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    const term = searchTerm.toLowerCase();
    return properties.filter(p => {
        const fullAddr = [p.address.nameOrNumber, p.address.street, p.address.postcode].filter(Boolean).join(' ').toLowerCase();
        return fullAddr.includes(term);
    });
  }, [properties, searchTerm]);

  useEffect(() => {
    if (!selectedPropertyId || !firestore || !user) return;

    const loadConfig = async () => {
        const configRef = doc(firestore, 'emergencyInfo', selectedPropertyId);
        getDoc(configRef)
            .then(snap => {
                if (snap.exists()) {
                    setFormData(snap.data() as EmergencyInfo);
                } else {
                    setFormData({
                        landlordName: user.displayName || '',
                        landlordEmail: user.email || '',
                        landlordAddress: '',
                        landlordPhone: '',
                        emergencyRepairContact: '',
                        emergencyRepairPhone: '',
                        nonEmergencyPhone: '',
                        nonEmergencyEmail: user.email || '',
                        localAuthorityInfo: ''
                    });
                }
            })
            .catch(async (error) => {
                if (error.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: configRef.path,
                        operation: 'get'
                    });
                    errorEmitter.emit('permission-error', permissionError);
                }
            });
    };

    loadConfig();
  }, [selectedPropertyId, firestore, user]);

  const handleSave = async () => {
    if (!selectedPropertyId || !firestore || !user) return;
    setIsSaving(true);
    
    const docRef = doc(firestore, 'emergencyInfo', selectedPropertyId);
    const savePayload = {
        ...formData,
        landlordId: user.uid,
        lastUpdated: new Date().toISOString()
    };

    setDoc(docRef, savePayload, { merge: true })
        .then(() => {
            toast({ title: "Registry Updated", description: "Emergency procedures saved for this asset." });
        })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'write',
                requestResourceData: savePayload
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: "Sync Failed" });
        })
        .finally(() => {
            setIsSaving(false);
        });
  };

  const handleExport = async () => {
    const prop = properties?.find(p => p.id === selectedPropertyId);
    if (!prop) return;
    setIsExporting(true);
    const addr = [prop.address.nameOrNumber, prop.address.street, prop.address.city, prop.address.postcode].filter(Boolean).join(', ');
    await generateEmergencyPDF(formData, addr);
    setIsExporting(false);
  };

  const formatAddress = (address: Property['address']) => [address.nameOrNumber, address.street, address.city, address.postcode].filter(Boolean).join(', ');

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-left animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 p-6 rounded-3xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary text-primary-foreground">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold font-headline text-primary tracking-tight">Emergency Procedures</h1>
        </div>
        <p className="text-muted-foreground font-medium text-lg ml-1">Configure property safety instructions and generate resident notices.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4">
            <Card className="shadow-md border-none overflow-hidden h-fit text-left">
                <CardHeader className="bg-muted/30 border-b text-left">
                    <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground text-left">Select Property</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search address or postcode..." 
                                className="pl-8 h-10" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <ScrollArea className="h-[400px]">
                        {isLoadingProps ? (
                            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/20" /></div>
                        ) : filteredProperties.length === 0 ? (
                            <div className="p-8 text-center text-xs italic text-muted-foreground">No matches found.</div>
                        ) : (
                            <div className="divide-y">
                                {filteredProperties.map((p) => (
                                    <div 
                                        key={p.id} 
                                        className={cn(
                                            "p-4 flex items-center justify-between cursor-pointer transition-colors hover:bg-primary/5",
                                            selectedPropertyId === p.id && "bg-primary/10 border-l-4 border-l-primary"
                                        )}
                                        onClick={() => setSelectedPropertyId(p.id)}
                                    >
                                        <div className="min-w-0 text-left">
                                            <p className="font-bold text-sm truncate">
                                                {[p.address.nameOrNumber, p.address.street].filter(Boolean).join(' ')}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{p.address.postcode}</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
            {!selectedPropertyId ? (
                <div className="h-full min-h-[400px] border-2 border-dashed rounded-[2rem] bg-muted/5 flex flex-col items-center justify-center gap-4 text-center p-8">
                    <div className="p-6 rounded-full bg-background shadow-xl"><ShieldAlert className="h-12 w-12 text-primary/20" /></div>
                    <div>
                        <p className="text-lg font-bold">Registry Context Required</p>
                        <p className="text-sm text-muted-foreground max-w-xs">Select a property from the sidebar to view or edit its specific emergency procedures.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <Card className="shadow-xl border-none overflow-hidden text-left">
                        <CardHeader className="bg-primary/5 border-b pb-6 text-left">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <CardTitle className="text-xl font-headline flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-primary" /> 
                                    Safety Configuration
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting} className="font-bold uppercase text-[10px] tracking-widest h-9 px-4">
                                        {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                                        Export PDF
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={isSaving} className="font-bold uppercase text-[10px] tracking-widest h-9 px-6 shadow-lg">
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </div>
                            <CardDescription className="font-medium text-left mt-2">
                                For: <strong className="text-foreground">{formatAddress(properties?.find(p => p.id === selectedPropertyId)?.address!)}</strong>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8 space-y-10">
                            <div className="space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-destructive flex items-center gap-2 border-b pb-2">
                                    <ShieldAlert className="h-4 w-4" /> STEP 1 – IMMEDIATE DANGER (FIXED)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl border bg-destructive/5 text-center">
                                        <Flame className="h-5 w-5 mx-auto mb-2 text-destructive" />
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Gas Leak</p>
                                        <p className="text-sm font-bold">0800 111 999</p>
                                    </div>
                                    <div className="p-4 rounded-xl border bg-destructive/5 text-center">
                                        <Zap className="h-5 w-5 mx-auto mb-2 text-destructive" />
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Electric</p>
                                        <p className="text-sm font-bold">Call 105</p>
                                    </div>
                                    <div className="p-4 rounded-xl border bg-destructive/5 text-center">
                                        <Ambulance className="h-5 w-5 mx-auto mb-2 text-destructive" />
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Emergency</p>
                                        <p className="text-sm font-bold">Call 999</p>
                                    </div>
                                </div>
                                <div className="bg-destructive/10 p-3 rounded-lg text-[10px] font-bold text-destructive uppercase text-center border border-destructive/20">
                                    Protocol: Do NOT contact landlord first in these situations.
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-orange-600 flex items-center gap-2 border-b pb-2">
                                    <Phone className="h-4 w-4" /> STEP 2 – URGENT EMERGENCIES (24/7)
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-bold uppercase">Emergency Repair Contact</Label>
                                        <Input placeholder="e.g. Acme Maintenance" value={formData.emergencyRepairContact} onChange={e => setFormData({...formData, emergencyRepairContact: e.target.value})} className="h-11" />
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-bold uppercase">Emergency Phone</Label>
                                        <Input placeholder="07XXX XXXXXX" value={formData.emergencyRepairPhone} onChange={e => setFormData({...formData, emergencyRepairPhone: e.target.value})} className="h-11" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-green-600 flex items-center gap-2 border-b pb-2">
                                    <Clock className="h-4 w-4" /> 3. NON-EMERGENCY REPAIRS
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-bold uppercase">Office Phone</Label>
                                        <Input value={formData.nonEmergencyPhone} onChange={e => setFormData({...formData, nonEmergencyPhone: e.target.value})} className="h-11" />
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-bold uppercase">Reporting Email</Label>
                                        <Input value={formData.nonEmergencyEmail} onChange={e => setFormData({...formData, nonEmergencyEmail: e.target.value})} className="h-11" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 border-t pt-8">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2 border-b pb-2">
                                    <Building2 className="h-4 w-4" /> 4. MANAGEMENT IDENTITY
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-bold uppercase">Landlord Name</Label>
                                        <Input value={formData.landlordName} onChange={e => setFormData({...formData, landlordName: e.target.value})} className="h-11" />
                                    </div>
                                    <div className="space-y-2 text-left">
                                        <Label className="text-[10px] font-bold uppercase">Contact Email</Label>
                                        <Input value={formData.landlordEmail} onChange={e => setFormData({...formData, landlordEmail: e.target.value})} className="h-11" />
                                    </div>
                                    <div className="space-y-2 text-left sm:col-span-2">
                                        <Label className="text-[10px] font-bold uppercase">Correspondence Address</Label>
                                        <Input value={formData.landlordAddress} onChange={e => setFormData({...formData, landlordAddress: e.target.value})} className="h-11" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 text-left">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 border-b pb-2">
                                    <AlertTriangle className="h-4 w-4" /> 5. LOCAL AUTHORITY (SERIOUS ISSUES)
                                </h3>
                                <div className="space-y-2 text-left">
                                    <Label className="text-[10px] font-bold uppercase">Council / Authority Contact Info</Label>
                                    <Textarea 
                                        rows={3} 
                                        placeholder="Specific council contact details for health & safety issues..." 
                                        className="resize-none rounded-xl bg-muted/5"
                                        value={formData.localAuthorityInfo}
                                        onChange={e => setFormData({...formData, localAuthorityInfo: e.target.value})}
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/10 border-t p-6 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-4">Registry Integrity</p>
                            <div className="bg-primary/10 text-primary p-4 rounded-xl border-2 border-primary/20 text-xs font-bold w-full max-w-sm">
                                🔒 Safety protocols are synchronized with the Resident Hub
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
