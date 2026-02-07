'use server';
/**
 * @fileOverview An AI flow to generate professional property listing descriptions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const PropertyDescriptionInputSchema = z.object({
  propertyType: z.string(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  address: z.string(),
  keyFeatures: z.string().optional(),
});
export type PropertyDescriptionInput = z.infer<typeof PropertyDescriptionInputSchema>;

const PropertyDescriptionOutputSchema = z.object({
  headline: z.string().describe('A catchy headline for the property listing.'),
  description: z.string().describe('A professional and engaging description of the property.'),
});
export type PropertyDescriptionOutput = z.infer<typeof PropertyDescriptionOutputSchema>;

export async function generatePropertyDescription(
  input: PropertyDescriptionInput
): Promise<PropertyDescriptionOutput> {
  return propertyDescriptionFlow(input);
}

const propertyDescriptionPrompt = ai.definePrompt({
  name: 'propertyDescriptionPrompt',
  input: { schema: PropertyDescriptionInputSchema },
  output: { schema: PropertyDescriptionOutputSchema },
  prompt: `You are an expert real estate copywriter. Your goal is to write a professional, engaging, and high-converting property listing description for a rental property in the UK.

  Property Details:
  - Type: {{{propertyType}}}
  - Bedrooms: {{{bedrooms}}}
  - Bathrooms: {{{bathrooms}}}
  - Location: {{{address}}}
  - Key Features/Notes: {{{keyFeatures}}}

  Instructions:
  1. Create a catchy headline.
  2. Write a description that highlights the property's potential and appeals to quality tenants.
  3. Keep the tone professional but welcoming.
  4. Use British English spelling.
  `,
});

const propertyDescriptionFlow = ai.defineFlow(
  {
    name: 'propertyDescriptionFlow',
    inputSchema: PropertyDescriptionInputSchema,
    outputSchema: PropertyDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await propertyDescriptionPrompt(input);
    return output!;
  }
);
