'use server';
/**
 * @fileOverview An AI flow to generate professional property listing descriptions.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { gemini15Flash } from '@genkit-ai/google-genai';

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
  model: gemini15Flash,
  input: { schema: PropertyDescriptionInputSchema },
  output: { schema: PropertyDescriptionOutputSchema },
  prompt: `You are an expert real estate copywriter. Write a professional, high-converting UK property listing.

  Property Details:
  - Type: {{{propertyType}}}
  - Bedrooms: {{{bedrooms}}}
  - Bathrooms: {{{bathrooms}}}
  - Location: {{{address}}}
  - Key Features: {{{keyFeatures}}}

  Requirements:
  1. Create a catchy, professional headline.
  2. Write an engaging description highlighting the benefits of the location and features.
  3. Use British English (e.g., 'centre', 'neighbourhood').
  4. Ensure the tone is inviting yet professional.
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
    if (!output) {
      throw new Error('AI failed to generate property description.');
    }
    return output;
  }
);
