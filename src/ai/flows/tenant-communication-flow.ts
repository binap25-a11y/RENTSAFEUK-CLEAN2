'use server';
/**
 * @fileOverview An AI flow to generate professional landlord-to-tenant communications.
 */

import { ai } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/google-genai';
import { z } from 'zod';

const TenantCommunicationInputSchema = z.object({
  tenantName: z.string(),
  propertyAddress: z.string(),
  communicationType: z.enum(['Rent Arrears', 'Inspection Notice', 'Maintenance Update', 'Tenancy Renewal', 'General Notice']),
  details: z.string().describe('Key details to include in the message.'),
  tone: z.enum(['Professional', 'Firm but Fair', 'Urgent', 'Friendly']).default('Professional'),
});
export type TenantCommunicationInput = z.infer<typeof TenantCommunicationInputSchema>;

const TenantCommunicationOutputSchema = z.object({
  subject: z.string().describe('A professional email subject line.'),
  message: z.string().describe('The body of the message/notice.'),
});
export type TenantCommunicationOutput = z.infer<typeof TenantCommunicationOutputSchema>;

export async function generateTenantCommunication(
  input: TenantCommunicationInput
): Promise<TenantCommunicationOutput> {
  return tenantCommunicationFlow(input);
}

const communicationPrompt = ai.definePrompt({
  name: 'tenantCommunicationPrompt',
  model: gemini15Flash,
  input: { schema: TenantCommunicationInputSchema },
  output: { schema: TenantCommunicationOutputSchema },
  prompt: `You are an expert UK property manager. Draft a professional notice to a tenant.

  Tenant Name: {{{tenantName}}}
  Property: {{{propertyAddress}}}
  Category: {{{communicationType}}}
  Specific Details: {{{details}}}
  Tone: {{{tone}}}

  Requirements:
  1. Use British English (e.g., 'authorised', 'favour').
  2. Include relevant legal context if it's a formal notice (like inspection).
  3. Ensure the tone matches the requested style.
  4. Make the message clear, concise, and professional.
  `,
});

const tenantCommunicationFlow = ai.defineFlow(
  {
    name: 'tenantCommunicationFlow',
    inputSchema: TenantCommunicationInputSchema,
    outputSchema: TenantCommunicationOutputSchema,
  },
  async (input) => {
    const { output } = await communicationPrompt(input);
    if (!output) {
      throw new Error('AI failed to generate communication output.');
    }
    return output;
  }
);
