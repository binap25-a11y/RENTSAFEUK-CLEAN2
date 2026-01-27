'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const plans = [
  {
    name: 'Free Starter',
    price: { monthly: 0, annually: 0 },
    description: 'For landlords just getting started.',
    features: [
      '1 Property',
      'Maintenance log (limited entries)',
      'Basic property details',
      'Manual reminders (no notifications)',
      'Contains ads or "upgrade" prompts',
    ],
    isMostPopular: false,
    href: '/dashboard',
  },
  {
    name: 'Standard Landlord',
    price: { monthly: 6.99, annually: 49 },
    description: 'Perfect for managing a small portfolio.',
    features: [
      'Up to 3 properties',
      'Unlimited maintenance logs',
      'Upload photos & documents',
      'Automatic reminders (Gas Safety, EICR, etc.)',
      'Export to PDF (for council/insurer)',
      'No ads',
    ],
    isMostPopular: true,
  },
  {
    name: 'Pro Landlord',
    price: { monthly: 14.99, annually: 149 },
    description: 'For serious investors and property managers.',
    features: [
      'Unlimited properties',
      'Advanced reminders',
      'Tenant issue tracking',
      'Contractor notes',
      'Full maintenance history',
      'Secure Cloud Data Storage',
      'Priority support',
    ],
    isMostPopular: false,
  },
];

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
       <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Our Pricing</h1>
      </div>
      <div className="flex flex-col items-center gap-8">
        <div className="flex items-center space-x-2">
          <Label htmlFor="billing-cycle">Monthly</Label>
          <Switch
            id="billing-cycle"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <Label htmlFor="billing-cycle">Annually</Label>
          <div className="ml-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            2 months free!
          </div>
        </div>

        <div className="grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn('flex flex-col', {
                'border-primary ring-2 ring-primary': plan.isMostPopular,
              })}
            >
              {plan.isMostPopular && (
                <div className="py-1 px-4 bg-primary text-center text-sm font-semibold text-primary-foreground rounded-t-lg">
                  Most Popular
                </div>
              )}
              <CardHeader className="items-center">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="text-center h-10">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-baseline justify-center gap-1 mb-6">
                  <span className="text-4xl font-bold">
                    £{isAnnual ? plan.price.annually : plan.price.monthly}
                  </span>
                  <span className="text-muted-foreground">
                    /{isAnnual ? 'year' : 'month'}
                  </span>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="mr-2 h-5 w-5 flex-shrink-0 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={plan.href || `/checkout?plan=${encodeURIComponent(plan.name)}&price=${isAnnual ? plan.price.annually : plan.price.monthly}&billing=${isAnnual ? 'year' : 'month'}`}>
                    Choose {plan.name}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
            All prices are subject to VAT. You can cancel your plan at any time.
        </p>
      </div>
    </div>
  );
}
