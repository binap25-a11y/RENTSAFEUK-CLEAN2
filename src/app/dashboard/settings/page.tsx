'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { updateProfile, deleteUser } from 'firebase/auth';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Clock, Lock, Key, AlertTriangle, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

const profileSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters.'),
  email: z.string().email().optional(),
  idleTimeoutMinutes: z.coerce.number().min(5, 'Minimum timeout is 5 minutes.'),
  role: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: '',
      email: '',
      idleTimeoutMinutes: 30,
      role: 'landlord',
    },
  });

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'userProfiles', user.uid);
  }, [firestore, user]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        email: user.email || '',
        idleTimeoutMinutes: profile?.idleTimeoutMinutes || 30,
        role: profile?.role || 'landlord',
      });
    }
  }, [user, profile, form]);

  async function onSubmit(data: ProfileFormValues) {
    if (!auth || !auth.currentUser || !firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to update your profile.',
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Update Firebase Auth Profile
      await updateProfile(auth.currentUser, {
        displayName: data.displayName,
      });
      
      // Update Firestore User Document
      await setDoc(doc(firestore, 'userProfiles', user.uid), {
        id: user.uid,
        displayName: data.displayName,
        idleTimeoutMinutes: data.idleTimeoutMinutes,
      }, { merge: true });
      
      await auth.currentUser.reload();

      toast({
        title: 'Settings Saved',
        description: 'Your profile and session preferences have been updated.',
      });

      router.refresh();

    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'There was an error updating your settings. Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  }

  const handleDeleteAccount = async () => {
    if (!auth || !auth.currentUser || !firestore || !user) return;
    
    setIsUpdating(true);
    try {
      // 1. Delete Firestore Profile
      await deleteDoc(doc(firestore, 'userProfiles', user.uid));
      
      // 2. Delete Auth User
      await deleteUser(auth.currentUser);
      
      toast({
        title: 'Account Deleted',
        description: 'Your account has been successfully removed from RentSafeUK.',
      });
      
      router.push('/');
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast({
          variant: 'destructive',
          title: 'Security Requirement',
          description: 'Please log out and log back in before deleting your account for security validation.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Deletion Failed',
          description: error.message || 'An error occurred. Please try again.',
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const isLoading = isUserLoading || isProfileLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentRole = form.watch('role') || 'landlord';

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
       <div>
        <h1 className="text-3xl font-bold font-headline">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account security and profile preferences.
        </p>
      </div>

      <div className="grid gap-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b bg-muted/10">
            <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Profile Details</CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold uppercase text-[9px] tracking-widest px-3">
                    <UserCircle className="mr-1.5 h-3.5 w-3.5" />
                    {currentRole} Account
                </Badge>
            </div>
            <CardDescription>
              Basic information used across your portfolio reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Login Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Email" {...field} disabled />
                      </FormControl>
                       <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Your email address is managed via your identity provider.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t">
                    <FormField
                        control={form.control}
                        name="idleTimeoutMinutes"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Automatic Sign-out Period</FormLabel>
                                <Select onValueChange={field.onChange} value={String(field.value)}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select timeout" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="15">15 Minutes</SelectItem>
                                        <SelectItem value="30">30 Minutes (Recommended)</SelectItem>
                                        <SelectItem value="60">1 Hour</SelectItem>
                                        <SelectItem value="120">2 Hours</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    Set how long the application should wait during inactivity before logging you out.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save All Changes
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-primary/20">
          <CardHeader className="border-b bg-primary/5">
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        Session Security
                    </CardTitle>
                    <CardDescription>
                        Configuration for your active management session.
                    </CardDescription>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Secure Connection</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex items-start gap-4 p-4 rounded-xl border bg-muted/30">
                    <Clock className="h-5 w-5 text-primary mt-1 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Automatic Sign-out</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            For your protection, you will be automatically logged out after <strong>{form.watch('idleTimeoutMinutes')} minutes</strong> of inactivity.
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-4 p-4 rounded-xl border bg-muted/30">
                    <ShieldCheck className="h-5 w-5 text-primary mt-1 shrink-0" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Data Encryption</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            All property data and tenant files are encrypted at rest and in transit using industry-standard AES-256.
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 border border-dashed flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Multi-Factor Authentication</span>
                </div>
                <p className="text-xs text-muted-foreground italic">Managed by your Google Account</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/20 mt-4 bg-destructive/[0.02]">
          <CardHeader className="border-b bg-destructive/5">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-lg">Danger Zone</CardTitle>
            </div>
            <CardDescription>
              Permanently delete your account and all associated management data.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-6">
              Deleting your account is permanent and cannot be undone. All your property records, tenant contacts, maintenance logs, and financial history will be inaccessible.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="font-bold">Delete Account & Data</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is irreversible. It will permanently delete your account, 
                    associated profile data, and all access keys.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount} 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Confirm Permanent Deletion
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
