'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo, GoogleIcon } from '@/components/icons';
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
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type FormValues = z.infer<typeof formSchema>;

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const handleAuthAction = (data: FormValues) => {
    if (!auth) return;
    setIsProcessing(true);
    setAuthError(null);

    const handleAuthError = (error: any) => {
      if (mode === 'login' && (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
          setAuthError('Invalid email or password. Please try again.');
      } else {
          toast({
              variant: 'destructive',
              title: `Failed to ${mode}`,
              description: error.message,
          });
      }
      setIsProcessing(false);
    };

    if (mode === 'signup') {
      createUserWithEmailAndPassword(auth, data.email, data.password)
        .catch(handleAuthError);
    } else {
      signInWithEmailAndPassword(auth, data.email, data.password)
        .catch(handleAuthError);
    }
  };

  const handlePasswordReset = async () => {
    const email = form.getValues('email');
    if (!email) {
      form.setError('email', {
        type: 'manual',
        message: 'Please enter your email to reset the password.',
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

  const toggleMode = (newMode: AuthMode) => {
    setMode(newMode);
    setAuthError(null);
    form.reset();
  }

  if (isUserLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
         <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center py-12 min-h-screen bg-muted/30">
        <Card className="mx-auto w-full max-w-sm shadow-xl border-none">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <Logo className="w-16 h-16 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold font-headline tracking-tight text-primary">
                RentSafeUK
              </CardTitle>
              <CardDescription className="text-sm font-medium">
                {mode === 'login' ? 'Sign in to your portfolio' : 'Create your landlord account'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {authError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAuthAction)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="name@example.com" {...field} className="h-11" />
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
                            className="h-11 pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-transparent"
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
                          <div className="text-right -mt-1">
                            <Button
                                type="button"
                                variant="link"
                                className="py-0 px-0 h-auto text-xs font-semibold text-muted-foreground hover:text-primary"
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
                <Button type="submit" className="w-full h-11 font-bold text-base shadow-md" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'login' ? 'Login' : 'Get Started'}
                </Button>
              </form>
            </Form>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                <span className="bg-card px-3 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
                <Button variant="outline" className="h-11 border-muted-foreground/20" onClick={handleGoogleSignIn} disabled={isProcessing}>
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  Google
                </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <div className="text-center text-sm">
              {mode === 'login' ? (
                <>
                  <span className="text-muted-foreground">Don&apos;t have an account?</span>{' '}
                  <Button variant="link" className="p-0 h-auto font-bold" onClick={() => toggleMode('signup')}>
                    Sign up
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Already have an account?</span>{' '}
                  <Button variant="link" className="p-0 h-auto font-bold" onClick={() => toggleMode('login')}>
                    Login
                  </Button>
                </>
              )}
            </div>
             <div className="text-center text-[10px] text-muted-foreground/60 leading-relaxed max-w-[280px]">
                By continuing, you agree to our{' '}
                <Link href="/terms-of-service" className="underline hover:text-primary">
                Terms of Service
                </Link>
                {' & '}
                <Link href="/privacy-policy" className="underline hover:text-primary">
                Privacy Policy
                </Link>
                .
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
