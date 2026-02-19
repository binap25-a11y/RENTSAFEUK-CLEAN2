'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Loader2, Wand2, Sparkles, Copy, Mail } from 'lucide-react';
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

export function TenantCommunicationAssistant({
  isOpen,
  onOpenChange,
  tenant,
  propertyAddress
}: TenantCommunicationAssistantProps) {
  const [commType, setCommType] = useState<'Rent Arrears' | 'Inspection Notice' | 'Maintenance Update' | 'Tenancy Renewal' | 'General Notice'>('General Notice');
  const [commDetails, setCommDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedComm, setGeneratedComm] = useState<TenantCommunicationOutput | null>(null);

  const handleGenerateComm = async () => {
    setIsGenerating(true);
    setGeneratedComm(null);
    
    toast({
        title: 'Drafting message...',
        description: 'The AI is generating your communication based on the details provided.',
    });

    try {
        const result = await generateTenantCommunication({
            tenantName: tenant.name,
            propertyAddress: propertyAddress,
            communicationType: commType,
            details: commDetails,
            tone: 'Professional'
        });
        setGeneratedComm(result);
        toast({
            title: 'Message Drafted',
            description: 'Review the generated notice below.',
        });
    } catch (e) {
        console.error('Communication Assistant failed:', e);
        toast({ 
            variant: 'destructive', 
            title: 'AI Assistant Error', 
            description: 'Could not generate the message. Please try again later.' 
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 pb-4 bg-background border-b">
                <DialogTitle className="flex items-center gap-2 text-xl font-headline">
                    <Sparkles className="h-6 w-6 text-primary" /> 
                    Communication Assistant
                </DialogTitle>
                <DialogDescription>Draft professional landlord notices tailored to this tenant.</DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1 bg-muted/5">
                <div className="p-6 space-y-8">
                    {/* Input Section */}
                    <div className="space-y-5 bg-muted/30 p-5 rounded-2xl border border-border/50 shadow-sm">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Reason for contact</Label>
                            <Select value={commType} onValueChange={(v: any) => setCommType(v)}>
                                <SelectTrigger className="bg-background h-11 border-primary/10 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['Rent Arrears', 'Inspection Notice', 'Maintenance Update', 'Tenancy Renewal', 'General Notice'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Specific Details</Label>
                            <Textarea 
                                placeholder="e.g. rent is 3 days late, inspection scheduled for Tuesday at 10am..." 
                                value={commDetails} 
                                onChange={e => setCommDetails(e.target.value)} 
                                className="min-h-[120px] bg-background resize-none border-primary/10 focus-visible:ring-primary/20"
                            />
                        </div>
                        <Button 
                            onClick={handleGenerateComm} 
                            disabled={isGenerating || !commDetails} 
                            className="w-full h-12 text-md font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] group"
                        >
                            {isGenerating ? (
                                <Loader2 className="animate-spin mr-2 h-5 w-5" />
                            ) : (
                                <Wand2 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                            )} 
                            {isGenerating ? 'AI is drafting...' : 'Generate Professional Notice'}
                        </Button>
                    </div>

                    {/* Result Section */}
                    {generatedComm && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-top-4 duration-500 pb-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-tight">
                                    <Sparkles className="h-4 w-4 text-primary" /> 
                                    AI Drafted Output
                                </h3>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-[10px] font-bold">READY TO SEND</Badge>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-card p-4 rounded-xl border border-border/60 shadow-sm">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Subject</p>
                                    <p className="text-sm font-bold text-foreground">{generatedComm.subject}</p>
                                </div>
                                <div className="bg-card p-5 rounded-xl border border-border/60 shadow-sm">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3">Message Body</p>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80 font-medium">
                                        {generatedComm.message}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button variant="outline" className="w-full h-11 border-primary/20 hover:bg-primary/5" onClick={() => {
                                    navigator.clipboard.writeText(`Subject: ${generatedComm.subject}\n\n${generatedComm.message}`);
                                    toast({ title: 'Copied to clipboard' });
                                }}>
                                    <Copy className="mr-2 h-4 w-4" /> Copy Text
                                </Button>
                                <Button className="w-full h-11 shadow-md" onClick={handleSendEmail}>
                                    <Mail className="mr-2 h-4 w-4" /> Send via Email
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
            
            <DialogFooter className="p-4 border-t bg-muted/20">
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-muted-foreground hover:text-foreground">
                    Dismiss Assistant
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
