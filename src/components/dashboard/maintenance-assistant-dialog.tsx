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
    } catch (error: any) {
      console.error('AI Maintenance Assistant Error:', error);
      let description = 'Could not get a diagnosis. Please try again.';
      if (error.message) {
        if (error.message.includes('fetch failed') && error.message.includes('generativelanguage.googleapis.com')) {
          description = 'Could not connect to the Google AI service. This is often caused by an invalid API key, or because billing has not been enabled on your Google Cloud project. Please check your .env file and Google Cloud console settings. (See README.md)';
        } else if (error.message.includes('fetch failed')) {
          description = 'The AI service is not reachable. Please ensure the Genkit server is running in a separate terminal. (See README.md)';
        } else if (error.message.includes('API key not valid')) {
          description = 'Your Gemini API key is invalid or missing. Please check your .env file. (See README.md)';
        } else if (error.message.toLowerCase().includes('failed precondition')) {
          description = 'The AI service failed. This may be due to billing not being enabled on your Google Cloud project or the "Generative Language API" is not active. Please check your Google Cloud console.';
        } else {
          description = `An unexpected error occurred: ${error.message}`;
        }
      }
      toast({
        variant: 'destructive',
        title: 'AI Assistant Error',
        description: description,
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
        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
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
              <AlertDescription>
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
