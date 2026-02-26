
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

/**
 * @fileOverview Monitors user activity and logs them out after a period of inactivity.
 * Reads the timeout period from the user's Firestore profile.
 */

export function IdleTimeout() {
  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch the user's profile to get their preferred timeout
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user]);
  
  const { data: profile } = useDoc(userProfileRef);

  // Default to 30 minutes if no preference is found
  const timeoutMinutes = profile?.idleTimeoutMinutes || 30;
  const idleTimeoutMs = timeoutMinutes * 60 * 1000;

  const handleLogout = useCallback(async () => {
    if (auth && auth.currentUser) {
      try {
        await signOut(auth);
        toast({
          title: 'Session Expired',
          description: `You have been logged out due to ${timeoutMinutes} minutes of inactivity.`,
        });
        router.push('/');
      } catch (error) {
        console.error('Failed to sign out during timeout:', error);
      }
    }
  }, [auth, router, timeoutMinutes]);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(handleLogout, idleTimeoutMs);
  }, [handleLogout, idleTimeoutMs]);

  useEffect(() => {
    // Events that count as "activity"
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

    // Initial set
    resetTimeout();

    // Attach listeners
    const eventHandler = () => resetTimeout();
    events.forEach((event) => {
      window.addEventListener(event, eventHandler);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, eventHandler);
      });
    };
  }, [resetTimeout]);

  return null; // This component doesn't render anything visually
}
