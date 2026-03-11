'use client';

/**
 * @fileOverview Shadow module cleared to resolve TypeError: signInNonBlocking is not a function.
 * Logic is now centralized in the .ts module to prevent circular resolution loops.
 */

export * from './non-blocking-login';
