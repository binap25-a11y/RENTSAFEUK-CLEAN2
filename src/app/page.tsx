'use client';

import { Button } from '@/components/ui/button';
import { Logo, GoogleIcon } from '@/components/icons';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithRedirect,
  GoogleAuthProvider,
} from 'firebase/auth';
import { useUser, useAuth, useFirestore, createUserNonBlocking, signInNonBlocking, type UserRole } from '@/firebase';
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
import { doc, getDoc, collection, query, where, getDocs, limit, setDoc, updateDoc } from 'firebase/firestore';

const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }).trim().toLowerCase(),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['landlord', 'agent', 'tenant']).default('landlord'),
});

type FormValues = z.infer<typeof formSchema>;

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && user && firestore) {
      const checkRoleAndRedirect = async () => {
        try {
          const userEmail = user.email?.toLowerCase().trim();
          if (!userEmail) {
              router.replace('/dashboard');
              return;
          }

          const userRef = doc(firestore, 'users', user.uid);
          const snap = await getDoc(userRef);
          
          let role: string | null = null;

          // DISCOVERY HANDSHAKE: Check residency registry by normalized email or current UID.
          const tenantsCol = collection(firestore, 'tenants');
          
          const qByUid = query(tenantsCol, where('userId', '==', user.uid), limit(1));
          let tenantSnap = await getDocs(qByUid);
          
          if (tenantSnap.empty) {
              const qByEmail = query(tenantsCol, where('email', '==', userEmail), limit(1));
              tenantSnap = await getDocs(qByEmail);
          }
          
          const isTenantInRegistry = !tenantSnap.empty;

          if (snap.exists()) {
            role = snap.data().role;
            if (role !== 'tenant' && isTenantInRegistry) {
                role = 'tenant';
                await updateDoc(userRef, { role: 'tenant' });
            }
          } else {
            role = isTenantInRegistry ? 'tenant' : (mode === 'signup' ? form.getValues('role') : 'landlord');
            await setDoc(userRef, {
              id: user.uid,
              email: userEmail,
              role: role,
              createdAt: new Date().toISOString(),
              idleTimeoutMinutes: 30
            });
          }
          
          if (role === 'tenant') {
            router.replace('/tenant/dashboard');
          } else {
            router.replace('/dashboard');
          }
        } catch (error: any) {
          console.warn("Login Handshake Deferred:", error.message);
          router.replace('/dashboard');
        }
      };
      
      checkRoleAndRedirect();
    }
  }, [user, isUserLoading, firestore, router, mode]);

  const handleAuthAction = (data: FormValues) => {
    if (!auth) return;
    setIsProcessing(true);
    setAuthError(null);

    const handleError = (error: any) => {
      // SPECIFIC FEEDBACK: Human-readable mapping for security-denied credentials.
      switch (error.code) {
          case 'auth/wrong-password':
          case 'auth/user-not-found':
          case 'auth/invalid-credential':
          case 'auth/invalid-email':
              setAuthError('The email or password you entered is incorrect. Please check your details and try again.');
              break;
          case 'auth/email-already-in-use':
              setAuthError('An account with this email address already exists. Please log in instead.');
              break;
          case 'auth/too-many-requests':
              setAuthError('Access temporarily disabled due to many failed attempts. Please try again later.');
              break;
          case 'auth/network-request-failed':
              setAuthError('Network error. Please check your internet connection.');
              break;
          default:
              setAuthError('Authentication failed. Please check your details or try again later.');
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
      setAuthError(null);
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'landlord',
    },
  });

  if (isUserLoading || (user && !authError)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
         <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse text-center">
                Resolving Identity Hub...
            </p>
         </div>
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
                {mode === 'login' ? 'Access your portal' : 'Create a management profile'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {authError && (
              <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex gap-3 text-left animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-bold text-destructive">Sign-in Error</p>
                    <p className="text-xs text-destructive/80 font-medium leading-relaxed">{authError}</p>
                </div>
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleAuthAction)} className="space-y-4 text-left">
                {mode === 'signup' && (
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="space-y-3 pb-2">
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Account Type</FormLabel>
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
                <><span className="text-muted-foreground">New user?</span>{' '}<Button variant="link" className="p-0 h-auto font-bold" onClick={() => toggleMode('signup')}>Sign up</Button></>
              ) : (
                <><span className="text-muted-foreground">Have an account?</span>{' '}<Button variant="link" className="p-0 h-auto font-bold" onClick={() => toggleMode('login')}>Log in</Button></>
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