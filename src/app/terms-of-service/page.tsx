import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
       <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Terms of Service</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <p>Last updated: July 22, 2024</p>
          
          <p className="font-bold text-destructive">
            Disclaimer: This is a template Terms of Service. You should consult with a legal professional to ensure it meets the specific needs and legal requirements of your business.
          </p>

          <h2 className="font-semibold text-lg pt-4">1. Agreement to Terms</h2>
          <p>
            By creating an account and using the RentSafeUK application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, then you may not access the Service.
          </p>

          <h2 className="font-semibold text-lg pt-4">2. Your Account</h2>
          <p>
            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service. You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.
          </p>

          <h2 className="font-semibold text-lg pt-4">3. Content</h2>
          <p>
            Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness. By posting Content to the Service, you grant us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such Content on and through the Service.
          </p>

          <h2 className="font-semibold text-lg pt-4">4. Prohibited Uses</h2>
          <p>
            You agree not to use the service for any unlawful purpose or to solicit others to perform or participate in any unlawful acts. You also agree not to upload or transmit viruses or any other type of malicious code that will or may be used in any way that will affect the functionality or operation of the Service.
          </p>

          <h2 className="font-semibold text-lg pt-4">5. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
          </p>

          <h2 className="font-semibold text-lg pt-4">6. Limitation of Liability</h2>
          <p>
            In no event shall RentSafeUK, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage.
          </p>

          <h2 className="font-semibold text-lg pt-4">7. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of the United Kingdom, without regard to its conflict of law provisions.
          </p>
          
           <h2 className="font-semibold text-lg pt-4">8. Contact Us</h2>
            <p>
                If you have any questions about these Terms, please contact us at: [Your Contact Email/Address Here]
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
