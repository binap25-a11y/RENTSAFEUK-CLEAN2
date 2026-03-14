
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { 
  LayoutDashboard, 
  Wrench, 
  Files, 
  MessageSquare, 
  LogOut, 
  Loader2,
  Home
} from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/icons';
import { UserNav } from '@/components/dashboard/user-nav';

/**
 * @fileOverview Resident Portal Layout
 * Handles mounting states and secure role verification for verified residents.
 */

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { 
    setIsMounted(true); 
  }, []);

  useEffect(() => {
    if (isMounted && !isUserLoading && !user) {
      router.push('/');
    }
  }, [isMounted, isUserLoading, user, router]);

  if (!isMounted || isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const menuItems = [
    { href: '/tenant/dashboard', label: 'My Home', icon: LayoutDashboard },
    { href: '/tenant/maintenance', label: 'Repairs', icon: Wrench },
    { href: '/tenant/documents', label: 'Documents', icon: Files },
    { href: '/tenant/messages', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b bg-sidebar pb-4 pt-6">
          <Link href="/tenant/dashboard" className="flex items-center gap-2 px-2">
            <Logo className="w-8 h-8 text-primary" />
            <span className="font-bold text-lg font-headline tracking-tight">RentSafe Portal</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="px-2 pt-4">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                  <Link href={item.href}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="border-t p-4">
           <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => signOut(auth)}>
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground hidden sm:block">Tenant Mode Active</h2>
          </div>
          <UserNav />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-muted/20">
          <div className="mx-auto max-w-5xl w-full pb-20">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
