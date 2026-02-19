'use server';
/**
 * @fileOverview An AI flow to analyze property documents and extract metadata.
 */

import { ai } from '@/ai/genkit';
import { gemini15Flash } from '@genkit-ai/google-genai';
import { z } from 'zod';

const DocumentAnalysisInputSchema = z.object({
  photoDataUri: z.string().describe("A photo of the document as a data URI."),
  documentHint: z.string().optional().describe("Hint about what the document might be."),
});
export type DocumentAnalysisInput = z.infer<typeof DocumentAnalysisInputSchema>;

const DocumentAnalysisOutputSchema = z.object({
  title: z.string().describe('Suggested title for the document.'),
  documentType: z.enum([
    'Tenancy Agreement', 'Inventory', 'Gas Safety Certificate', 'Electrical Certificate', 'EPC', 'Insurance', 'Deposit Protection', 'Licence', 'Correspondence', 'Invoice'
  ]).describe('Categorized type of the document.'),
  issueDate: z.string().optional().describe('Extracted issue date in YYYY-MM-DD format.'),
  expiryDate: z.string().optional().describe('Extracted expiry date in YYYY-MM-DD format.'),
  amount: z.number().optional().describe('Extracted total amount (for invoices).'),
  notes: z.string().describe('Key observations or extracted text snippets.'),
});
export type DocumentAnalysisOutput = z.infer<typeof DocumentAnalysisOutputSchema>;

export async function analyzeDocument(input: DocumentAnalysisInput): Promise<DocumentAnalysisOutput> {
  return documentAnalysisFlow(input);
}

const documentAnalysisPrompt = ai.definePrompt({
  name: 'documentAnalysisPrompt',
  model: gemini15Flash,
  input: { schema: DocumentAnalysisInputSchema },
  output: { schema: DocumentAnalysisOutputSchema },
  prompt: `You are an expert UK property compliance assistant. Analyze the provided image of a property document and extract metadata.

  Photo: {{media url=photoDataUri}}
  User Hint: {{{documentHint}}}

  Tasks:
  1. Identify the document type (e.g., Gas Safety, EPC, etc.).
  2. Extract Issue and Expiry Dates if present (format as YYYY-MM-DD).
  3. For invoices, extract the total amount.
  4. Create a concise, professional title for the record.
  5. Provide a brief summary of notes or key data found.
  `,
});

const documentAnalysisFlow = ai.defineFlow(
  {
    name: 'documentAnalysisFlow',
    inputSchema: DocumentAnalysisInputSchema,
    outputSchema: DocumentAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await documentAnalysisPrompt(input);
    if (!output) {
      throw new Error('AI failed to analyze the document.');
    }
    return output;
  }
);
