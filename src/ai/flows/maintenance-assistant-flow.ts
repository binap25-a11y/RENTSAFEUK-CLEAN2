'use server';
/**
 * @fileOverview An AI assistant for diagnosing property maintenance issues.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MaintenanceAssistantInputSchema = z.object({
  problemDescription: z.string().describe('A description of the maintenance problem provided by the user.'),
});
export type MaintenanceAssistantInput = z.infer<typeof MaintenanceAssistantInputSchema>;

const MaintenanceAssistantOutputSchema = z.object({
  likelyCause: z.string().describe('A brief, likely cause of the problem.'),
  troubleshootingSteps: z.array(z.string()).describe('A short list of simple troubleshooting steps a landlord or tenant could try.'),
  urgency: z.enum(['Low', 'Routine', 'Urgent', 'Emergency']).describe('The assessed urgency of the issue.'),
  suggestedTitle: z.string().describe('A concise, descriptive title for logging the maintenance issue.'),
  suggestedCategory: z.enum(['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other']).describe('The most likely category for this issue.'),
});
export type MaintenanceAssistantOutput = z.infer<typeof MaintenanceAssistantOutputSchema>;

export async function runMaintenanceAssistant(
  input: MaintenanceAssistantInput
): Promise<MaintenanceAssistantOutput> {
  return maintenanceAssistantFlow(input);
}

const maintenanceAssistantPrompt = ai.definePrompt({
    name: 'maintenanceAssistantPrompt',
    model: 'googleai/gemini-1.5-flash',
    input: { schema: MaintenanceAssistantInputSchema },
    output: { schema: MaintenanceAssistantOutputSchema },
    prompt: `You are an expert AI assistant for UK property landlords and maintenance contractors. 
    Your role is to diagnose common household maintenance issues.

    Analyze the following problem description:
    "{{{problemDescription}}}"

    Based on the description, provide:
    1. Likely Cause
    2. Troubleshooting Steps (simple things to check before calling a contractor)
    3. Urgency (Low, Routine, Urgent, Emergency)
    4. Suggested Title for a maintenance log
    5. Suggested Category
    `,
});

const maintenanceAssistantFlow = ai.defineFlow(
  {
    name: 'maintenanceAssistantFlow',
    inputSchema: MaintenanceAssistantInputSchema,
    outputSchema: MaintenanceAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await maintenanceAssistantPrompt(input);
    if (!output) {
      throw new Error('AI failed to generate maintenance diagnosis.');
    }
    return output;
  }
);
