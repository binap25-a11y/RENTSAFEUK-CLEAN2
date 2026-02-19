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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> 
                    Tenant Communication Assistant
                </DialogTitle>
                <DialogDescription>Draft professional landlord notices tailored to this tenant.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Reason for contact</Label>
                        <Select value={commType} onValueChange={(v: any) => setCommType(v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {['Rent Arrears', 'Inspection Notice', 'Maintenance Update', 'Tenancy Renewal', 'General Notice'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Specific Details</Label>
                        <Textarea 
                            placeholder="e.g. rent is 3 days late, inspection scheduled for Tuesday at 10am..." 
                            value={commDetails} 
                            onChange={e => setCommDetails(e.target.value)} 
                            className="min-h-[100px]"
                        />
                    </div>
                    <Button onClick={handleGenerateComm} disabled={isGenerating || !commDetails} className="w-full">
                        {isGenerating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Wand2 className="mr-2 h-4 w-4" />} 
                        {isGenerating ? 'Drafting...' : 'Generate Message'}
                    </Button>

                    {generatedComm && (
                        <div className="mt-4 p-4 rounded-lg bg-muted border animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-bold text-sm">Drafted Communication</p>
                                <Badge variant="outline" className="bg-background">AI Generated</Badge>
                            </div>
                            <div className="bg-background p-3 rounded border mb-4">
                                <p className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
                                <p className="text-sm font-medium">{generatedComm.subject}</p>
                            </div>
                            <div className="bg-background p-3 rounded border">
                                <p className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-1">Message Body</p>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{generatedComm.message}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <Button variant="outline" className="w-full" onClick={() => {
                                    navigator.clipboard.writeText(`Subject: ${generatedComm.subject}\n\n${generatedComm.message}`);
                                    toast({ title: 'Copied to clipboard' });
                                }}>
                                    <Copy className="mr-2 h-4 w-4" /> Copy Text
                                </Button>
                                <Button className="w-full" onClick={handleSendEmail}>
                                    <Mail className="mr-2 h-4 w-4" /> Send via Email
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
            <DialogFooter className="border-t pt-4">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Close Assistant</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
