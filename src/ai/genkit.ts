import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash, // Sets the default model for the instance
});
