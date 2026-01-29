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
  useSidebar,
} from '@/components/ui/sidebar';
import { MainNav } from '@/components/dashboard/main-nav';
import { UserNav } from '@/components/dashboard/user-nav';
import { Logo } from '@/components/icons';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Notifications } from '@/components/dashboard/notifications';
import { SearchProvider, useSearch } from '@/context/SearchProvider';
import { Separator } from '@/components/ui/separator';
import { BackToTopButton } from '@/components/ui/back-to-top-button';

function DashboardHeader() {
  const { searchTerm, setSearchTerm } = useSearch();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
      <SidebarTrigger className="md:hidden" />
      <div className="w-full flex-1">
        <form>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search properties..."
              className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </form>
      </div>
      <Notifications />
      <UserNav />
    </header>
  );
}

// New component for mobile search in sidebar
function MobileSearch() {
  const { searchTerm, setSearchTerm } = useSearch();
  const { isMobile } = useSidebar();

  if (!isMobile) {
    return null;
  }

  return (
    <>
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search properties..."
            className="w-full appearance-none bg-background pl-8 shadow-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
    </>
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
    <SearchProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo className="w-8 h-8 text-primary" />
              <span className="font-bold text-lg font-headline">RentSafeUK</span>
            </Link>
          </SidebarHeader>
          <MobileSearch />
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
    </SearchProvider>
  );
}
