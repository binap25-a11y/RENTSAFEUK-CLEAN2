'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutPage() {
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
      toast({
        title: 'Payment Successful!',
        description: `You are now subscribed to the ${plan} plan.`,
      });
      router.push('/dashboard');
    }, 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Complete Your Purchase</CardTitle>
          <CardDescription>You are subscribing to the <strong>{plan}</strong> plan.</CardDescription>
        </CardHeader>
        <form onSubmit={handlePayment}>
          <CardContent className="space-y-6">
            <div className="flex justify-between items-baseline p-4 rounded-lg bg-muted">
              <span className="font-semibold">Total Due Today</span>
              <span className="text-2xl font-bold">£{price} <span className="text-sm font-normal text-muted-foreground">/{billing}</span></span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-name">Name on Card</Label>
              <Input id="card-name" placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-number">Card Details</Label>
              {/* This would be a real payment element from Stripe/Braintree in production */}
              <div className="grid grid-cols-3 gap-2">
                <Input id="card-number" placeholder="Card Number" className="col-span-3" required />
                <Input placeholder="MM / YY" required />
                <Input placeholder="CVC" required />
                <Input placeholder="Postcode" required />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Pay £${price}`}
            </Button>
            <Button variant="outline" className="w-full" asChild>
                <Link href="/pricing">Cancel</Link>
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
