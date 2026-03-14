'use client';

/**
 * Consolidated Firebase SDK Barrel File.
 * Re-exports everything from modularized utility files.
 * Core initialization is handled in init.ts to prevent circular dependencies.
 */

export * from './init';
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './firestore-utilities';
export * from './auth-utilities';
export * from './errors';
export * from './error-emitter';
