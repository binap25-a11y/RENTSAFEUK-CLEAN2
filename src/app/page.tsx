'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Logo } from '@/components/icons';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const loginImage = PlaceHolderImages.find(
    (img) => img.id === 'login-background'
  );
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleAnonymousSignIn = () => {
    if (auth) {
      signInAnonymously(auth).catch((error) => {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: error.message,
        });
        console.error('Login error:', error);
      });
    }
  };

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <Logo className="w-16 h-16 mx-auto" />
            <h1 className="text-3xl font-bold font-headline mt-2">RentSafeUK</h1>
            <p className="text-balance text-muted-foreground">
              Sign in to manage your properties
            </p>
          </div>
          <div className="grid gap-4">
            <Button onClick={handleAnonymousSignIn} className="w-full">
              Sign In Anonymously
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Note: To use Google or Email/Password, you must enable them in your Firebase project's console.
            </p>
          </div>
           <div className="mt-4 text-center text-sm">
            <Link href="/pricing" className="underline">
              Pricing
            </Link>
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <Link
              href="/terms-of-service"
              className="underline hover:text-primary"
            >
              Terms of Service
            </Link>
            {' and '}
            <Link
              href="/privacy-policy"
              className="underline hover:text-primary"
            >
              Privacy Policy
            </Link>
            .
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        {loginImage && (
          <Image
            src={loginImage.imageUrl}
            alt={loginImage.description}
            data-ai-hint={loginImage.imageHint}
            width="1200"
            height="1800"
            className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          />
        )}
      </div>
    </div>
  );
}
