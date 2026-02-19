'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

/**
 * @fileOverview Monitors user activity and logs them out after a period of inactivity.
 * Default timeout is 30 minutes.
 */

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function IdleTimeout() {
  const auth = useAuth();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    if (auth && auth.currentUser) {
      try {
        await signOut(auth);
        toast({
          title: 'Session Expired',
          description: 'You have been logged out due to inactivity for security reasons.',
        });
        router.push('/');
      } catch (error) {
        console.error('Failed to sign out during timeout:', error);
      }
    }
  }, [auth, router]);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
  }, [handleLogout]);

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
