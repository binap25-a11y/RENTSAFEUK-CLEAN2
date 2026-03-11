'use client';

/**
 * @fileOverview Shadow module cleared to resolve "module has no exports" server errors.
 * Webpack was prioritizing this empty .tsx over the .ts source logic.
 * Logic is now consolidated in non-blocking-updates.ts.
 */

export * from './non-blocking-updates';
