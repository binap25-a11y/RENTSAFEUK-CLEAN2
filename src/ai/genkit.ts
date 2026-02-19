import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 * 
 * This file initializes the Genkit instance with the Google AI plugin.
 * We use the explicit string identifier to ensure stable model selection
 * across all generation calls and avoid "Must supply a model" errors.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
