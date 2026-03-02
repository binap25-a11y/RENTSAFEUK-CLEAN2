import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
       <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <p>Last updated: July 22, 2024</p>

          <p className="font-bold text-destructive">
            Disclaimer: This is a template Privacy Policy. You should consult with a legal professional to ensure it meets the specific needs and legal requirements of your business.
          </p>

          <h2 className="font-semibold text-lg pt-4">1. Introduction</h2>
          <p>
            Welcome to RentSafeUK. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
          </p>

          <h2 className="font-semibold text-lg pt-4">2. Collection of Your Information</h2>
          <p>
            We may collect information about you in a variety of ways. The information we may collect via the Application depends on the content and materials you use, and includes:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and telephone number, and other data that you voluntarily give to us when you register with the Application.
            </li>
            <li>
              <strong>Data from Your Use of the App:</strong> We collect information about the properties, maintenance requests, inspections, and documents you manage through the app.
            </li>
            <li>
              <strong>Device Information:</strong> We may collect information about your mobile device, including, for example, the hardware model, operating system and version, and unique device identifiers.
            </li>
          </ul>

          <h2 className="font-semibold text-lg pt-4">3. Use of Your Information</h2>
          <p>
            Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>Create and manage your account.</li>
            <li>Provide and manage our services, such as property, maintenance, and document management.</li>
            <li>Communicate with you about your account or services.</li>
            <li>Monitor and analyze usage and trends to improve your experience with the Application.</li>
            <li>Comply with legal obligations.</li>
          </ul>

          <h2 className="font-semibold text-lg pt-4">4. Disclosure of Your Information</h2>
          <p>
            We may share information we have collected about you in certain situations. Your information may be disclosed as follows:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.
            </li>
            <li>
              <strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including data storage, hosting services, and customer service. We use Firebase services (Google) for backend infrastructure, and your data is stored on their servers.
            </li>
          </ul>

          <h2 className="font-semibold text-lg pt-4">5. Security of Your Information</h2>
          <p>
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
          </p>
          
          <h2 className="font-semibold text-lg pt-4">6. Contact Us</h2>
            <p>
                If you have questions or comments about this Privacy Policy, please contact us at: [Your Contact Email/Address Here]
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
