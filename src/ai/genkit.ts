import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 * Standardizes the AI engine to use explicit model identifiers and API key lookup.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
    }),
  ],
  // Using the string identifier ensures the model is correctly resolved in all contexts.
  model: 'googleai/gemini-1.5-flash',
});
