'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Sparkles, Copy, Mail, MessageSquareText, Type } from 'lucide-react';
import { generateTenantCommunication, type TenantCommunicationOutput } from '@/ai/flows/tenant-communication-flow';
import { toast } from '@/hooks/use-toast';

interface TenantCommunicationAssistantProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: {
    name: string;
    email: string;
  };
  propertyAddress: string;
}

type Tone = 'Professional' | 'Firm but Fair' | 'Urgent' | 'Friendly';

export function TenantCommunicationAssistant({
  isOpen,
  onOpenChange,
  tenant,
  propertyAddress
}: TenantCommunicationAssistantProps) {
  const [commType, setCommType] = useState<'Rent Arrears' | 'Inspection Notice' | 'Maintenance Update' | 'Tenancy Renewal' | 'General Notice'>('General Notice');
  const [tone, setTone] = useState<Tone>('Professional');
  const [commDetails, setCommDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComm, setGeneratedComm] = useState<TenantCommunicationOutput | null>(null);

  const handleGenerateComm = async () => {
    if (!commDetails.trim()) {
        toast({ variant: 'destructive', title: 'Details missing', description: 'Please provide some context for the message.' });
        return;
    }

    setIsGenerating(true);
    setGeneratedComm(null);
    
    try {
        const result = await generateTenantCommunication({
            tenantName: tenant.name,
            propertyAddress: propertyAddress,
            communicationType: commType,
            details: commDetails,
            tone: tone
        });
        setGeneratedComm(result);
        toast({ title: 'Draft Ready' });
    } catch (e) {
        console.error('Communication Assistant failed:', e);
        toast({ 
            variant: 'destructive', 
            title: 'AI Error', 
            description: 'Could not generate message. Please ensure your API key is configured.' 
        });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSendEmail = () => {
    if (!generatedComm) return;
    const mailtoLink = `mailto:${tenant.email}?subject=${encodeURIComponent(generatedComm.subject)}&body=${encodeURIComponent(generatedComm.message)}`;
    window.location.href = mailtoLink;
  };

  const handleCopy = () => {
    if (!generatedComm) return;
    navigator.clipboard.writeText(`Subject: ${generatedComm.subject}\n\n${generatedComm.message}`);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-[650px] h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl">
            <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-headline font-bold">AI Communication Assistant</DialogTitle>
                        <DialogDescription className="text-xs">Draft professional notices for {tenant.name}.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <MessageSquareText className="h-3 w-3" />
                                Category
                            </Label>
                            <Select value={commType} onValueChange={(v: any) => setCommType(v)}>
                                <SelectTrigger className="bg-muted/30">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {['Rent Arrears', 'Inspection Notice', 'Maintenance Update', 'Tenancy Renewal', 'General Notice'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <Type className="h-3 w-3" />
                                Tone
                            </Label>
                            <Select value={tone} onValueChange={(v: any) => setTone(v)}>
                                <SelectTrigger className="bg-muted/30">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {['Professional', 'Firm but Fair', 'Urgent', 'Friendly'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Details</Label>
                        <Textarea 
                            placeholder="e.g. rent is 3 days late, inspection scheduled for Tuesday..." 
                            value={commDetails} 
                            onChange={e => setCommDetails(e.target.value)} 
                            className="min-h-[100px] resize-none bg-muted/30"
                        />
                    </div>

                    {generatedComm && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 pt-4 border-t pb-6">
                            <div className="bg-muted/30 p-4 rounded-lg border">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Subject</p>
                                <p className="text-sm font-bold">{generatedComm.subject}</p>
                            </div>
                            <div className="bg-muted/30 p-4 rounded-lg border">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-2">Message</p>
                                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {generatedComm.message}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" size="sm" onClick={handleCopy} className="w-full">
                                    <Copy className="mr-2 h-4 w-4" /> Copy
                                </Button>
                                <Button size="sm" onClick={handleSendEmail} className="w-full">
                                    <Mail className="mr-2 h-4 w-4" /> Open Email
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
            
            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
                <div className="flex w-full gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
                        Close
                    </Button>
                    <Button 
                        onClick={handleGenerateComm} 
                        disabled={isGenerating || !commDetails.trim()} 
                        className="flex-[2] font-bold shadow-md active:scale-95 transition-transform"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Wand2 className="mr-2 h-4 w-4" />
                                Generate Professional Notice
                            </>
                        )}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
