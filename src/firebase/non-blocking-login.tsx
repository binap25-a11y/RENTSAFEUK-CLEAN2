'use client';

/**
 * @fileOverview Explicit proxy to the stable .ts implementation.
 * Ensures that regardless of extension preference, the bundler resolves the correct logic.
 */

export * from './non-blocking-login.ts';
