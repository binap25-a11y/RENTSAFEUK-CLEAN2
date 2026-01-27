'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import {
  runMaintenanceAssistant,
  MaintenanceAssistantOutput,
} from '@/ai/flows/maintenance-assistant-flow';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface MaintenanceAssistantDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLogIssue: (suggestion: MaintenanceAssistantOutput) => void;
}

export function MaintenanceAssistantDialog({
  isOpen,
  onOpenChange,
  onLogIssue,
}: MaintenanceAssistantDialogProps) {
  const [problemDescription, setProblemDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MaintenanceAssistantOutput | null>(null);

  const handleDiagnose = async () => {
    if (!problemDescription.trim()) {
      toast({
        variant: 'destructive',
        title: 'Description needed',
        description: 'Please describe the maintenance issue.',
      });
      return;
    }
    setIsLoading(true);
    setResult(null);
    try {
      const assistantResult = await runMaintenanceAssistant({ problemDescription });
      setResult(assistantResult);
    } catch (error) {
      console.error('AI Maintenance Assistant Error:', error);
      toast({
        variant: 'destructive',
        title: 'AI Assistant Error',
        description: 'Could not get a diagnosis. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogClick = () => {
    if (result) {
      onLogIssue(result);
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'destructive';
      case 'Urgent': return 'secondary';
      default: return 'outline';
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            AI Maintenance Assistant
          </DialogTitle>
          <DialogDescription>
            Describe the maintenance issue below. The AI will help diagnose it,
            suggest troubleshooting steps, and assess the urgency.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="e.g., 'The upstairs radiator is cold but all the others are hot.' or 'There's a damp patch on the ceiling in the living room.'"
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            rows={4}
          />
          <Button onClick={handleDiagnose} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Diagnosing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Diagnose Issue
              </>
            )}
          </Button>

          {result && (
            <Alert>
              <AlertTitle className="font-bold">{result.suggestedTitle}</AlertTitle>
              <AlertDescription asChild>
                <div className="space-y-4 mt-2">
                   <div>
                        <p className="font-semibold text-foreground">Urgency</p>
                        <Badge variant={getPriorityVariant(result.urgency)}>{result.urgency}</Badge>
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">Likely Cause</p>
                        <p>{result.likelyCause}</p>
                    </div>
                     <div>
                        <p className="font-semibold text-foreground">Troubleshooting Steps</p>
                        <ul className="list-disc pl-5 space-y-1">
                            {result.troubleshootingSteps.map((step, i) => (
                                <li key={i}>{step}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">Suggested Category</p>
                        <p>{result.suggestedCategory}</p>
                    </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleLogClick} disabled={!result}>
            Log this Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
