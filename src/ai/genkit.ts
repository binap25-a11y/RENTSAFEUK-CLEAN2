import {genkit} from 'genkit';
import {googleAI, gemini15Flash} from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 * 
 * This file initializes the Genkit instance with the Google AI plugin.
 * It uses the gemini15Flash constant to ensure the correct model identifier
 * is used across all AI flows in the application.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
