'use client';

/**
 * @fileOverview Shadow module cleared to resolve TypeError: signInNonBlocking is not a function.
 * Webpack was prioritizing this empty .tsx over the .ts source logic.
 * Logic is now consolidated in non-blocking-login.ts.
 */

export * from './non-blocking-login';
