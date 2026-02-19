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
import { Loader2, Wand2, Sparkles, Copy, Mail, Type, MessageSquareText, ChevronDown } from 'lucide-react';
import { generateTenantCommunication, type TenantCommunicationOutput } from '@/ai/flows/tenant-communication-flow';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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
        toast({
            title: 'Draft Ready',
            description: 'Your notice has been generated successfully.',
        });
    } catch (e) {
        console.error('Communication Assistant failed:', e);
        toast({ 
            variant: 'destructive', 
            title: 'AI Assistant Error', 
            description: 'Could not generate the message. Please check your connection and try again.' 
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
    toast({ title: 'Copied to clipboard', description: 'Subject and body copied successfully.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] h-[90vh] sm:h-auto max-h-[95vh] flex flex-col p-0 overflow-hidden bg-background">
            <DialogHeader className="p-6 pb-4 border-b shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-headline">AI Communication Assistant</DialogTitle>
                        <DialogDescription className="text-xs">Draft professional notices for {tenant.name}.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1">
                <div className="p-6 space-y-6">
                    {/* Input Section */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                    <MessageSquareText className="h-3 w-3" />
                                    Notice Category
                                </Label>
                                <Select value={commType} onValueChange={(v: any) => setCommType(v)}>
                                    <SelectTrigger className="h-11 bg-muted/30">
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
                                    <SelectTrigger className="h-11 bg-muted/30">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['Professional', 'Firm but Fair', 'Urgent', 'Friendly'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Context & Details</Label>
                            <Textarea 
                                placeholder="e.g. rent is 3 days late, inspection scheduled for Tuesday at 10am..." 
                                value={commDetails} 
                                onChange={e => setCommDetails(e.target.value)} 
                                className="min-h-[120px] resize-none bg-muted/30"
                            />
                        </div>

                        <Button 
                            onClick={handleGenerateComm} 
                            disabled={isGenerating || !commDetails.trim()} 
                            className="w-full h-12 text-md font-bold shadow-sm"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                                    Drafting...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="mr-2 h-5 w-5" />
                                    Generate Professional Notice
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Result Section */}
                    {generatedComm && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-4 border-t pt-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-xs flex items-center gap-2 uppercase tracking-widest text-primary">
                                    <Sparkles className="h-4 w-4" /> 
                                    AI Draft
                                </h3>
                                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Drafted</Badge>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="bg-muted/30 p-4 rounded-lg border">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Email Subject</p>
                                    <p className="text-sm font-bold">{generatedComm.subject}</p>
                                </div>
                                <div className="bg-muted/30 p-6 rounded-lg border relative group">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-3">Message Body</p>
                                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                        {generatedComm.message}
                                    </div>
                                    <div className="absolute top-4 right-4">
                                        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0 opacity-50 hover:opacity-100">
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button variant="outline" className="w-full h-11" onClick={handleCopy}>
                                    <Copy className="mr-2 h-4 w-4" /> Copy Text
                                </Button>
                                <Button className="w-full h-11" onClick={handleSendEmail}>
                                    <Mail className="mr-2 h-4 w-4" /> Open in Email
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
            
            <DialogFooter className="p-4 border-t bg-muted/10 shrink-0">
                <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-muted-foreground">
                    Close Assistant
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
