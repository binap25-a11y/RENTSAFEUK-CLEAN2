'use server';
/**
 * @fileOverview An AI flow to generate professional landlord-tenant communication.
 * 
 * - generateTenantCommunication - Main function to draft a professional notice.
 * - TenantCommunicationInput - Schema for the tenant and notice details.
 * - TenantCommunicationOutput - Schema for the generated subject and message.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { gemini15Flash } from '@genkit-ai/google-genai';

const TenantCommunicationInputSchema = z.object({
  tenantName: z.string(),
  propertyAddress: z.string(),
  communicationType: z.enum(['Rent Arrears', 'Inspection Notice', 'Maintenance Update', 'Tenancy Renewal', 'General Notice']),
  details: z.string().describe('Specific details to include in the message.'),
  tone: z.enum(['Professional', 'Firm but Fair', 'Urgent', 'Friendly']).default('Professional'),
});
export type TenantCommunicationInput = z.infer<typeof TenantCommunicationInputSchema>;

const TenantCommunicationOutputSchema = z.object({
  subject: z.string().describe('Email subject line.'),
  message: z.string().describe('The body of the message.'),
});
export type TenantCommunicationOutput = z.infer<typeof TenantCommunicationOutputSchema>;

export async function generateTenantCommunication(input: TenantCommunicationInput): Promise<TenantCommunicationOutput> {
  return tenantCommunicationFlow(input);
}

const communicationPrompt = ai.definePrompt({
  name: 'tenantCommunicationPrompt',
  model: gemini15Flash,
  input: { schema: TenantCommunicationInputSchema },
  output: { schema: TenantCommunicationOutputSchema },
  prompt: `You are an expert UK property manager and legal assistant. 
  Write a professional communication to a tenant.

  Tenant: {{{tenantName}}}
  Property: {{{propertyAddress}}}
  Type: {{{communicationType}}}
  Specific Details: {{{details}}}
  Tone: {{{tone}}}

  Requirements:
  1. Use a legally compliant and professional structure.
  2. If it's an inspection, mention that 24 hours notice is required and has been provided.
  3. Use British English (e.g., 'favour', 'authorised').
  4. Ensure the subject line is concise and clear.
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
