import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 */
export const ai = genkit({
  plugins: [googleAI()],
  // Using the explicit model constant ensures the correct API version and model identifier are used.
  model: gemini15Flash,
});
