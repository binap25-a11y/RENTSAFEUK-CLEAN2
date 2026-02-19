import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 * Standardizes the AI engine to use official model constants for reliable routing.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
    }),
  ],
  // Defaulting to the Flash constant ensures all calls inherit the correct model identity.
  model: gemini15Flash,
});
