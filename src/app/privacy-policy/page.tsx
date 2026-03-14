import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl text-left">
       <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-headline">Privacy Policy</h1>
      </div>
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-xl">RentSafeUK Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-8 pb-10">
          <p className="text-sm text-muted-foreground font-medium">Last updated: March 2026</p>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">1. Introduction</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Welcome to RentSafeUK. Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our application and related services.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground font-medium italic">
              By using the app, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-foreground mb-2">Personal Information</h3>
                <p className="text-sm text-muted-foreground mb-2">When you use the app we may collect the following information:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Account login information</li>
                  <li>Property information</li>
                  <li>Tenant and landlord details</li>
                  <li>Messages sent within the platform</li>
                  <li>Maintenance requests</li>
                  <li>Uploaded documents or photos</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-foreground mb-2">Technical Information</h3>
                <p className="text-sm text-muted-foreground mb-2">We may also collect technical data including:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>Device information</li>
                  <li>IP address</li>
                  <li>Browser type</li>
                  <li>Usage data</li>
                  <li>Log data</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">3. How We Use Your Information</h2>
            <p className="text-sm text-muted-foreground mb-2">We use the collected data to:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Provide and maintain the service</li>
              <li>Manage landlord and tenant accounts</li>
              <li>Enable messaging between users</li>
              <li>Manage property information</li>
              <li>Process maintenance requests</li>
              <li>Improve platform performance</li>
              <li>Detect fraud, abuse, or security issues</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">4. Third-Party Services</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Our app uses third-party services to operate effectively. These services may collect limited information necessary to perform their functions.
            </p>
            <p className="text-sm text-muted-foreground mt-2">Examples include:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Cloud database and authentication services</li>
              <li>Hosting and infrastructure services</li>
              <li>Analytics and error monitoring tools</li>
            </ul>
            <p className="text-sm italic text-muted-foreground mt-2">These services process data only as required to operate the platform.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">5. Data Storage and Security</h2>
            <p className="text-sm text-muted-foreground">We take reasonable measures to protect your personal information from:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Unauthorized access</li>
              <li>Disclosure</li>
              <li>Alteration</li>
              <li>Destruction</li>
            </ul>
            <p className="text-sm font-medium text-destructive mt-2">However, no internet-based service can be completely secure.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">6. Data Sharing</h2>
            <p className="text-sm text-muted-foreground">We do not sell your personal data. Information may be shared only:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Between landlords and tenants within the platform</li>
              <li>With service providers required to operate the app</li>
              <li>When required by law or legal process</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">7. Data Retention</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We retain user data only as long as necessary to provide services and comply with legal obligations. Users may request account deletion which will remove associated personal information where possible.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">8. Your Rights</h2>
            <p className="text-sm text-muted-foreground">Depending on your location, you may have rights to:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for processing</li>
            </ul>
            <p className="text-sm text-muted-foreground">Requests can be made by contacting us.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">9. Children's Privacy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This application is not intended for individuals under the age of 18. We do not knowingly collect personal information from minors.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-primary">10. Changes to This Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may update this Privacy Policy periodically. Updates will be posted within the app or on our website.
            </p>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="font-bold text-lg text-primary">11. Contact Us</h2>
            <p className="text-sm text-muted-foreground">
              If you have questions about this Privacy Policy, you may contact us at:
            </p>
            <Button variant="link" className="p-0 h-auto font-bold text-primary" asChild>
              <a href="mailto:support@rentsafeuk.com">support@rentsafeuk.com</a>
            </Button>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
