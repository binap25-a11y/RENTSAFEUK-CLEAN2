'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, Suspense } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

/**
 * @fileOverview Checkout processing page.
 * Uses force-dynamic and Suspense to prevent build-time bailout when using useSearchParams.
 */

export const dynamic = 'force-dynamic';

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'Unknown Plan';
  const price = searchParams.get('price') || '0';
  const billing = searchParams.get('billing') || 'month';
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    // Simulate payment processing
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
  };

  return (
    <Card className="w-full max-w-md">
      <form onSubmit={handlePayment}>
        <CardHeader>
          <CardTitle>Confirm Your Subscription</CardTitle>
          <CardDescription>You are subscribing to the <strong>{plan}</strong> plan. You will be redirected to our secure payment provider to complete your purchase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-baseline p-4 rounded-lg bg-muted">
            <span className="font-semibold">Total Due Today</span>
            <span className="text-2xl font-bold">£{price} <span className="text-sm font-normal text-muted-foreground">/{billing}</span></span>
          </div>
           <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span>Payments are processed securely by our third-party partner.</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full h-11 font-bold" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Proceed to Payment`}
          </Button>
          <Button variant="outline" className="w-full" asChild>
              <Link href="/pricing">Cancel</Link>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function CheckoutPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md p-8 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Initializing Checkout...</p>
        </Card>
      }>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}