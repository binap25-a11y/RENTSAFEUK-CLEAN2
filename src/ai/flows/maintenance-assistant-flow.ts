'use server';
/**
 * @fileOverview An AI assistant for diagnosing property maintenance issues.
 *
 * - maintenanceAssistantFlow - A function that analyzes a maintenance problem description.
 * - MaintenanceAssistantInput - The input type for the flow.
 * - MaintenanceAssistantOutput - The return type for the flow.
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
  suggestedTitle: z.string().describe('A concise, descriptive title for logging the maintenance issue, e.g., "Kitchen sink leaking under cabinet".'),
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
    prompt: `You are an expert AI assistant for UK property landlords. Your role is to diagnose common household maintenance issues based on a user's description.

    Analyze the following problem description:
    "{{{problemDescription}}}"

    Based on the description, provide the following:
    1.  **Likely Cause**: A brief explanation of the most probable cause of the issue.
    2.  **Troubleshooting Steps**: A few simple, safe steps a non-professional could take to try and resolve the problem or gather more information. Prioritize safety.
    3.  **Urgency**: Assess the urgency based on UK landlord responsibilities. Use one of these four levels: 'Low', 'Routine', 'Urgent', 'Emergency'. An 'Emergency' is something that poses an immediate risk to health or the property (e.g., major leak, no heating in winter, security risk). 'Urgent' needs attention within 24-48 hours. 'Routine' can be scheduled. 'Low' is minor.
    4.  **Suggested Title**: Create a clear, concise title for a maintenance log entry.
    5.  **Suggested Category**: Choose the most appropriate category for this issue from the following list: ['Plumbing', 'Electrical', 'Heating', 'Structural', 'Appliances', 'Garden', 'Cleaning', 'Pest Control', 'Other'].
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
    return output!;
  }
);
