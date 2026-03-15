/**
 * @fileOverview Centralized Date Utilities for RentSafeUK
 * Provides robust conversion between Firestore Timestamps, ISO strings, and JS Dates
 * to prevent RangeErrors and hydration mismatches.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Robustly converts any date-like value into a Javascript Date object.
 * Returns null if the value is invalid or missing.
 */
export function safeToDate(val: any): Date | null {
  if (!val) return null;
  
  // Handle Firestore Timestamp
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === 'object' && val.seconds !== undefined) {
    return new Date(val.seconds * 1000);
  }
  
  // Handle Date object
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  
  // Handle ISO strings or numbers
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Prepares a Date for input[type="date"] fields.
 * Format: YYYY-MM-DD
 */
export function formatDateForInput(val: any): string {
  const date = safeToDate(val);
  if (!date) return '';
  return date.toISOString().split('T')[0];
}
