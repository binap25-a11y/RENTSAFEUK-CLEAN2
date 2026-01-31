'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { GoogleIcon, Logo } from '@/components/icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithRedirect,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Eye, EyeOff } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type FormValues = z.infer<typeof formSchema>;

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const loginImage = PlaceHolderImages.find(
    (img) => img.id === 'login-background'
  );
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleAuthAction = async (data: FormValues) => {
    if (!auth) return;
    setIsProcessing(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, data.email, data.password);
      } else {
        await signInWithEmailAndPassword(auth, data.email, data.password);
      }
      // The useEffect will handle the redirect on user state change
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: `Failed to ${mode}`,
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasswordReset = async () => {
    const email = form.getValues('email');
    if (!email) {
      form.setError('email', {
        type: 'manual',
        message: 'Please enter your email to reset the password.',
      });
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Please enter your email address to reset your password.',
      });
      return;
    }
    if (!auth) return;

    setIsProcessing(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: 'Password Reset Email Sent',
        description: `Check your inbox at ${email} for instructions to reset your password.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to Send Reset Email',
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (auth) {
      setIsProcessing(true);
      const provider = new GoogleAuthProvider();
      signInWithRedirect(auth, provider)
        .catch((error) => {
          toast({
            variant: 'destructive',
            title: 'Google Sign-In Failed',
            description: error.message,
          });
        })
        .finally(() => {
          setIsProcessing(false);
        });
    }
  };

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <Card className="mx-auto w-full max-w-sm">
          <CardHeader className="text-center">
             <Logo className="w-16 h-16 mx-auto" />
            <CardTitle className="text-2xl font-bold font-headline mt-2">
              {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
            </CardTitle>
            <CardDescription>
              Enter your credentials to {mode}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAuthAction)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:bg-transparent"
                            onClick={() => setShowPassword((prev) => !prev)}
                          >
                            <span className="sr-only">
                              {showPassword ? 'Hide password' : 'Show password'}
                            </span>
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                       {mode === 'login' && (
                          <div className="text-right -mt-2">
                            <Button
                                type="button"
                                variant="link"
                                className="py-0 px-0 h-auto text-sm font-normal"
                                onClick={handlePasswordReset}
                                disabled={isProcessing}
                            >
                                Forgot password?
                            </Button>
                          </div>
                      )}
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'login' ? 'Login' : 'Sign Up'}
                </Button>
              </form>
            </Form>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" onClick={handleGoogleSignIn} disabled={isProcessing}>
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  Google
                </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="text-center text-sm">
              {mode === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={() => setMode('signup')}>
                    Sign up
                  </Button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Button variant="link" className="p-0 h-auto" onClick={() => setMode('login')}>
                    Login
                  </Button>
                </>
              )}
            </div>
             <div className="text-center text-xs text-muted-foreground">
                By continuing, you agree to our{' '}
                <Link href="/terms-of-service" className="underline hover:text-primary">
                Terms
                </Link>
                {' & '}
                <Link href="/privacy-policy" className="underline hover:text-primary">
                Privacy
                </Link>
                .
            </div>
          </CardFooter>
        </Card>
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
