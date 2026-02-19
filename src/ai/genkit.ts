import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * @fileOverview Genkit configuration for RentSafeUK.
 * 
 * This file initializes the Genkit instance with the Google AI plugin.
 * We use the explicit string identifier for the model to ensure stability
 * across generation calls.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
