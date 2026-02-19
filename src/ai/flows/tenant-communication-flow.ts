'use server';
/**
 * @fileOverview An AI flow to generate professional landlord-tenant communication.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

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
  model: 'googleai/gemini-1.5-flash',
  input: { schema: TenantCommunicationInputSchema },
  output: { schema: TenantCommunicationOutputSchema },
  prompt: `You are an expert UK property manager. Write a professional communication to a tenant.

  Tenant: {{{tenantName}}}
  Property: {{{propertyAddress}}}
  Type: {{{communicationType}}}
  Specific Details: {{{details}}}
  Tone: {{{tone}}}

  Instructions:
  1. Ensure the message is legally compliant with UK landlord-tenant expectations.
  2. Use a professional and clear structure.
  3. For "Inspection Notice", ensure at least 24 hours notice is mentioned as per the Landlord and Tenant Act 1985.
  4. For "Rent Arrears", remain firm but fair and request contact to resolve.
  5. Use British English spelling.
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
    return output!;
  }
);
