import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * @fileOverview Terms and Conditions Page
 * Updated March 2026. Provides the legal framework for the RentSafeUK platform.
 */

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl text-left">
       <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-headline">Terms and Conditions</h1>
      </div>
      <Card className="border-none shadow-lg">
        <CardHeader className="bg-primary/5 border-b">
          <CardTitle className="text-xl text-primary">RentSafeUK Terms and Conditions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-8 pb-10">
          <p className="text-sm text-muted-foreground font-medium">Last updated: March 2026</p>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By accessing or using the RentSafeUK application, you agree to comply with and be bound by these Terms and Conditions.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground font-medium italic">
              If you do not agree, you must not use the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">2. Description of Service</h2>
            <p className="text-sm text-muted-foreground mb-2">RentSafeUK provides a digital platform that allows landlords and tenants to:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>manage property information</li>
              <li>communicate via messaging</li>
              <li>submit maintenance requests</li>
              <li>store documents and records</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">The platform is provided as a tool to assist property management.</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">3. User Accounts</h2>
            <p className="text-sm text-muted-foreground mb-2">Users must:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>provide accurate information</li>
              <li>maintain the confidentiality of their account</li>
              <li>notify us of unauthorized access</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground mt-2">
              You are responsible for all activities that occur under your account.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">4. Acceptable Use</h2>
            <p className="text-sm text-muted-foreground mb-2">Users agree not to:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>use the platform for unlawful activities</li>
              <li>upload harmful or malicious content</li>
              <li>attempt to gain unauthorized access to systems</li>
              <li>disrupt or interfere with platform operations</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">5. Landlord and Tenant Responsibilities</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The platform does not act as a legal intermediary between landlords and tenants.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              All agreements, responsibilities, and obligations between users remain their own.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground font-medium">
              Users are responsible for complying with local housing laws and regulations.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">6. Content and Data</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Users retain ownership of content they upload to the platform.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By uploading content, you grant RentSafeUK permission to store and process that content to provide the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">7. Service Availability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We aim to provide continuous service but do not guarantee uninterrupted availability.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Maintenance, updates, or technical issues may occasionally limit access.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">8. Limitation of Liability</h2>
            <p className="text-sm text-muted-foreground mb-2">RentSafeUK is provided on an "as is" basis. We are not liable for:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
              <li>disputes between landlords and tenants</li>
              <li>financial losses arising from property agreements</li>
              <li>damages resulting from misuse of the platform</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">9. Termination</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We reserve the right to suspend or terminate accounts that violate these terms. Users may also stop using the service at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">10. Changes to Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may update these Terms and Conditions periodically. Continued use of the platform after updates means you accept the revised terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-bold text-lg text-foreground">11. Governing Law</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These terms are governed by the laws of the United Kingdom.
            </p>
          </section>

          <section className="space-y-3 border-t pt-6">
            <h2 className="font-bold text-lg text-foreground">12. Contact</h2>
            <p className="text-sm text-muted-foreground">
              Questions regarding these terms can be sent to:
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
