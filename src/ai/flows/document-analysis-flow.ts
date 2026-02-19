'use server';
/**
 * @fileOverview An AI flow to analyze property documents and extract metadata.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { gemini15Flash } from '@genkit-ai/google-genai';

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
  prompt: `You are an expert UK property compliance assistant. Analyze the image and extract metadata.

  Photo: {{media url=photoDataUri}}
  User Hint: {{{documentHint}}}

  1. Identify document type.
  2. Extract Issue and Expiry Dates (YYYY-MM-DD).
  3. Extract total amounts for invoices.
  4. Create a professional title.
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
    return output!;
  }
);
