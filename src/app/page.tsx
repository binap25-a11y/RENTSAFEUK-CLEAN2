'use client';

import { Button } from '@/components/ui/button';
import { Logo, GoogleIcon } from '@/components/icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithRedirect,
  GoogleAuthProvider,
} from 'firebase/auth';
import { useUser, useAuth, createUserNonBlocking, signInNonBlocking, type UserRole } from '@/firebase';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Eye, EyeOff, AlertCircle, ShieldCheck, Building2, Users, UserCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['landlord', 'agent', 'tenant']).default('landlord'),
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
      role: 'landlord',
    },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const handleAuthAction = (data: FormValues) => {
    if (!auth) {
      setAuthError("Authentication service is not available.");
      return;
    }
    setIsProcessing(true);
    setAuthError(null);

    const handleError = (error: any) => {
      switch (error.code) {
          case 'auth/wrong-password':
          case 'auth/user-not-found':
          case 'auth/invalid-credential':
              setAuthError('Invalid email or password.');
              break;
          case 'auth/email-already-in-use':
              setAuthError('An account with this email already exists.');
              break;
          default:
              setAuthError(error.message || 'Authentication failed.');
      }
      setIsProcessing(false);
    };

    if (mode === 'signup') {
      createUserNonBlocking(auth, data.email, data.password, data.role as UserRole, handleError);
    } else {
      signInNonBlocking(auth, data.email, data.password, handleError);
    }
  };

  const handleGoogleSignIn = () => {
    if (auth) {
      setIsProcessing(true);
      const provider = new GoogleAuthProvider();
      signInWithRedirect(auth, provider).catch((error) => {
          toast({ variant: 'destructive', title: 'Sign-In Failed', description: error.message });
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
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-center py-12 min-h-screen bg-muted/30">
        <Card className="mx-auto w-full max-sm shadow-xl border-none text-left">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <Logo className="w-16 h-16 text-primary" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-bold font-headline tracking-tight text-primary">
                RentSafeUK
              </CardTitle>
              <CardDescription className="text-sm font-medium">
                {mode === 'login' ? 'Access your landlord or tenant portal' : 'Join the RentSafeUK platform'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {authError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAuthAction)} className="space-y-4 text-left">
                {mode === 'signup' && (
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="space-y-3 pb-2">
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Your Role</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="grid grid-cols-3 gap-2"
                          >
                            <FormItem>
                              <FormLabel className="[&:has([data-state=checked])]:border-primary border-2 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 transition-all">
                                <FormControl>
                                  <RadioGroupItem value="landlord" className="sr-only" />
                                </FormControl>
                                <Building2 className="h-5 w-5" />
                                <span className="text-[10px] font-bold uppercase">Landlord</span>
                              </FormLabel>
                            </FormItem>
                            <FormItem>
                              <FormLabel className="[&:has([data-state=checked])]:border-primary border-2 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 transition-all">
                                <FormControl>
                                  <RadioGroupItem value="agent" className="sr-only" />
                                </FormControl>
                                <Users className="h-5 w-5" />
                                <span className="text-[10px] font-bold uppercase">Agent</span>
                              </FormLabel>
                            </FormItem>
                            <FormItem>
                              <FormLabel className="[&:has([data-state=checked])]:border-primary border-2 rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 transition-all">
                                <FormControl>
                                  <RadioGroupItem value="tenant" className="sr-only" />
                                </FormControl>
                                <UserCircle className="h-5 w-5" />
                                <span className="text-[10px] font-bold uppercase">Tenant</span>
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
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
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-11 font-bold text-base shadow-md" disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'login' ? 'Log In' : 'Create Account'}
                </Button>
              </form>
            </Form>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-card px-3 text-muted-foreground">Or continue with</span></div>
            </div>
            <Button variant="outline" className="w-full h-11 border-muted-foreground/20" onClick={handleGoogleSignIn} disabled={isProcessing}>
              <GoogleIcon className="mr-2 h-4 w-4" /> Sign in with Google
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pt-2">
            <div className="text-center text-sm">
              {mode === 'login' ? (
                <><span className="text-muted-foreground">New to RentSafeUK?</span>{' '}<Button variant="link" className="p-0 h-auto font-bold" onClick={() => toggleMode('signup')}>Sign up</Button></>
              ) : (
                <><span className="text-muted-foreground">Already have an account?</span>{' '}<Button variant="link" className="p-0 h-auto font-bold" onClick={() => toggleMode('login')}>Log in</Button></>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                <ShieldCheck className="h-3 w-3" />
                Secure UK Property Cloud
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
