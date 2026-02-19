import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 * 
 * This file initializes the Genkit instance with the Google AI plugin.
 * We use the gemini15Flash constant to ensure stable model selection
 * across all generation calls.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
