import 'dotenv/config'; // Load environment variables from .env file
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 * Standardizes the AI engine to use explicit model strings for reliable routing.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY,
    }),
  ],
  // Standardizing on the string identifier resolves model resolution issues in Genkit 1.x
  model: 'googleai/gemini-1.5-flash',
});
