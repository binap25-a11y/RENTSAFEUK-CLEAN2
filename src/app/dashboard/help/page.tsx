'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  ShieldCheck, 
  Database, 
  Globe, 
  CheckCircle2, 
  ExternalLink,
  HelpCircle,
  BookOpen,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';

export default function HelpPage() {
  const launchSteps = [
    {
      title: 'Deploy to App Hosting',
      description: 'Go to the Firebase Console and connect your repository to App Hosting for automatic production builds.',
      icon: Rocket,
      status: 'Recommended'
    },
    {
      title: 'Configure Custom Domain',
      description: 'Add your own domain in the Firebase Hosting settings to give your portal a professional identity.',
      icon: Globe,
      status: 'Optional'
    },
    {
      title: 'Verify Security Rules',
      description: 'Ensure your Firestore rules are strictly limited to owner-only access before adding sensitive tenant data.',
      icon: ShieldCheck,
      status: 'Critical'
    },
    {
      title: 'Initialize Real Data',
      description: 'Clear your test records and perform a clean onboarding of your actual property portfolio.',
      icon: Database,
      status: 'Ready'
    }
  ];

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto py-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Launch Center & Support</h1>
        <p className="text-muted-foreground mt-1">Everything you need to move from prototype to professional management.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Production Launch Checklist
            </CardTitle>
            <CardDescription>Follow these steps to take RentSafeUK live.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {launchSteps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="mt-1">
                  <div className="p-2 rounded-full bg-primary/10">
                    <step.icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{step.title}</p>
                    <Badge variant={step.status === 'Critical' ? 'destructive' : 'secondary'} className="text-[10px] h-4">
                      {step.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Developer Documentation</CardTitle>
              <CardDescription>Resources for advanced customization.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button variant="outline" className="justify-start" asChild>
                <a href="https://firebase.google.com/docs" target="_blank" rel="noreferrer">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Firebase Documentation
                  <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="https://nextjs.org/docs" target="_blank" rel="noreferrer">
                  <Globe className="mr-2 h-4 w-4" />
                  Next.js App Router Guide
                  <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-lg">Need Assistance?</CardTitle>
              <CardDescription>Get help with your portfolio management setup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                If you encounter any technical issues or need help structuring your data, please contact your account manager or use our support forum.
              </p>
              <Button className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="pt-8 border-t">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">RentSafeUK Version 1.0.0 (Stable Prototype)</p>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/terms-of-service" className="hover:underline">Terms of Service</Link>
            <span>•</span>
            <Link href="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
