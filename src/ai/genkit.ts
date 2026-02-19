import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 */
export const ai = genkit({
  plugins: [googleAI()],
  // Using explicit string identifier for maximum stability across Genkit environments
  model: 'googleai/gemini-1.5-flash',
});
