'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { GoogleIcon, Logo } from '@/components/icons';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';

export default function LoginPage() {
  const loginImage = PlaceHolderImages.find((img) => img.id === 'login-background');
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleGoogleSignIn = () => {
    if (auth) {
      const provider = new GoogleAuthProvider();
      signInWithRedirect(auth, provider);
    }
  };

  if (isUserLoading || user) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <Logo className="w-16 h-16 mx-auto" />
            <h1 className="text-3xl font-bold font-headline mt-2">RentSafe</h1>
            <p className="text-balance text-muted-foreground">
              Sign in to manage your properties
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="#"
                  className="ml-auto inline-block text-sm underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input id="password" type="password" required />
            </div>
            <Button className="w-full" asChild>
              <Link href="/dashboard">Login</Link>
            </Button>
            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
              <GoogleIcon className="mr-2 h-4 w-4" />
              Login with Google
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="#" className="underline">
              Sign up
            </Link>
            {' | '}
            <Link href="/pricing" className="underline">
              Pricing
            </Link>
          </div>
           <div className="mt-2 text-center text-xs text-muted-foreground">
            By continuing, you agree to our{' '}
            <Link href="/terms-of-service" className="underline hover:text-primary">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href="/privacy-policy" className="underline hover:text-primary">
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
