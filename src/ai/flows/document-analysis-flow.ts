
'use server';
/**
 * @fileOverview An AI flow to analyze property documents and extract metadata.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const DocumentAnalysisInputSchema = z.object({
  photoDataUri: z.string().describe("A photo of the document as a data URI."),
  documentHint: z.string().optional().describe("Hint about what the document might be (e.g., 'Gas safety')."),
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
  input: { schema: DocumentAnalysisInputSchema },
  output: { schema: DocumentAnalysisOutputSchema },
  prompt: `You are an expert UK property compliance assistant. 
  Your task is to analyze the provided image of a document and extract the relevant metadata for a landlord's records.

  Photo: {{media url=photoDataUri}}
  User Hint: {{{documentHint}}}

  Instructions:
  1. Identify the document type from the predefined list.
  2. Extract the "Issue Date" and "Expiry Date" if present. Many UK safety certificates (Gas, EICR) have clear expiry dates.
  3. For invoices, extract the total amount including VAT.
  4. Create a professional title (e.g., "Gas Safety Certificate - 2024").
  5. Provide a summary in the notes field.
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
