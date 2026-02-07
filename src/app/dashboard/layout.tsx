'use client';

import Link from 'next/link';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { MainNav } from '@/components/dashboard/main-nav';
import { UserNav } from '@/components/dashboard/user-nav';
import { Logo } from '@/components/icons';
import { Loader2, Share2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Notifications } from '@/components/dashboard/notifications';
import { BackToTopButton } from '@/components/ui/back-to-top-button';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/dashboard/share-dialog';

function DashboardHeader() {
  const [isShareOpen, setIsShareOpen] = useState(false);

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="w-full flex-1">
        {/* Search functionality is now handled on specific pages like Properties. */}
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsShareOpen(true)} 
          className="text-muted-foreground hover:text-primary hidden sm:flex"
          title="Share App"
        >
          <Share2 className="h-5 w-5" />
          <span className="sr-only">Share App</span>
        </Button>
        <ShareDialog isOpen={isShareOpen} onOpenChange={setIsShareOpen} />
        <Notifications />
        <UserNav />
      </div>
    </header>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo className="w-8 h-8 text-primary" />
            <span className="font-bold text-lg font-headline">RentSafeUK</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <MainNav />
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if any */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
        <BackToTopButton />
      </SidebarInset>
    </SidebarProvider>
  );
}
