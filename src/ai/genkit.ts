import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 */
export const ai = genkit({
  plugins: [googleAI()],
  // We specify the default model as a string to ensure robust resolution across all flows.
  model: 'googleai/gemini-1.5-flash',
});
