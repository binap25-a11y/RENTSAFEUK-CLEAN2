
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Home,
  Wrench,
  CalendarCheck,
  Files,
  Settings,
  ChevronRight,
  CreditCard,
  Bell,
  Users,
  HardHat,
  MessageSquare,
  Newspaper,
  ShieldAlert,
} from 'lucide-react';
import * as React from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { 
    href: '/dashboard/properties', 
    label: 'Properties', 
    icon: Home,
    subItems: [
        { href: '/dashboard/properties', label: 'All Properties' },
        { href: '/dashboard/properties/add', label: 'Add Property' },
        { href: '/dashboard/properties/deleted', label: 'Deleted Properties' },
    ],
  },
  { 
    href: '/dashboard/tenants', 
    label: 'Tenants', 
    icon: Users,
    subItems: [
        { href: '/dashboard/tenants', label: 'All Tenants' },
        { href: '/dashboard/tenants/add', label: 'Add Tenant' },
    ],
  },
  { 
    href: '/dashboard/contractors', 
    label: 'Contractors', 
    icon: HardHat,
    subItems: [
        { href: '/dashboard/contractors', label: 'All Contractors' },
        { href: '/dashboard/contractors/add', label: 'Add Contractor' },
    ],
  },
  { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
  { 
    href: '/dashboard/inspections', 
    label: 'Inspections', 
    icon: CalendarCheck,
    subItems: [
        { href: '/dashboard/inspections', label: 'All Inspections' },
        { href: '/dashboard/inspections/single-let', label: 'New Single-Let' },
        { href: '/dashboard/inspections/hmo', label: 'New HMO' },
    ],
  },
  { 
    href: '/dashboard/documents', 
    label: 'Documents', 
    icon: Files,
    subItems: [
        { href: '/dashboard/documents', label: 'All Documents' },
        { href: '/dashboard/documents/upload', label: 'Log Document' },
    ],
  },
  { href: '/dashboard/expenses', label: 'Financials', icon: CreditCard },
  { href: '/dashboard/reminders', label: 'Reminders', icon: Bell },
  { href: '/dashboard/messages', label: 'Communication Hub', icon: MessageSquare },
  { href: '/dashboard/emergency', label: 'Emergency Procedures', icon: ShieldAlert },
  { href: '/dashboard/news', label: 'News and Law Updates', icon: Newspaper },
];

export function MainNav() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { user } = useUser();
  const firestore = useFirestore();
  const [openItems, setOpenItems] = React.useState<string[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    // Open the parent menu if a sub-item is active
    const activeParent = menuItems.find(item => item.subItems?.some(sub => pathname.startsWith(sub.href)));
    if (activeParent && !openItems.includes(activeParent.href)) {
      setOpenItems(prev => [...prev, activeParent.href]);
    }
  }, [pathname]);

  // Real-time unread count listener for Landlord Messages
  React.useEffect(() => {
    if (!user || !firestore) return;
    
    // We listen for unread messages sent by tenants to the landlord
    const q = query(
        collection(firestore, 'messages'),
        where('landlordId', '==', user.uid),
        limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
        const unreadFromTenants = snap.docs.filter(d => {
            const data = d.data();
            return data.senderId !== user.uid && data.read !== true;
        });
        setUnreadCount(unreadFromTenants.length);
    });

    return () => unsub();
  }, [user, firestore]);

  const handleToggle = (href: string) => {
    setOpenItems(prev => prev.includes(href) ? prev.filter(item => item !== href) : [...prev, href]);
  };
  
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu>
      {menuItems.map(({ href, label, icon: Icon, subItems }) => (
        <SidebarMenuItem key={href}>
          {subItems ? (
             <Collapsible open={openItems.includes(href)} onOpenChange={() => handleToggle(href)}>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        isActive={pathname.startsWith(href)}
                        className='justify-between'
                        tooltip={label}
                    >
                        <div className='flex items-center gap-2'>
                            <Icon />
                            <span>{label}</span>
                        </div>
                        <ChevronRight className={`h-4 w-4 transition-transform ${openItems.includes(href) ? 'rotate-90' : ''}`} />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {subItems.map(sub => (
                            <SidebarMenuSubItem key={sub.href}>
                                <SidebarMenuSubButton asChild isActive={pathname === sub.href}>
                                    <Link href={sub.href} onClick={handleLinkClick}>{sub.label}</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
             </Collapsible>
          ) : (
            <SidebarMenuButton
              asChild
              isActive={
                href === '/dashboard'
                  ? pathname === href
                  : pathname.startsWith(href)
              }
              tooltip={label}
            >
              <Link href={href} onClick={handleLinkClick} className="flex items-center justify-between w-full text-left">
                <div className="flex items-center gap-2 min-w-0">
                    <Icon className="shrink-0" />
                    <span className="truncate">{label}</span>
                </div>
                {label === 'Communication Hub' && unreadCount > 0 && (
                    <Badge className="h-5 px-1.5 min-w-[20px] justify-center bg-primary text-primary-foreground font-bold text-[10px] rounded-full shadow-sm animate-in fade-in zoom-in duration-300">
                        {unreadCount}
                    </Badge>
                )}
              </Link>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      ))}
       <SidebarMenuItem className="mt-auto pt-4">
          <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/settings')} tooltip="Settings">
              <Link href="/dashboard/settings" onClick={handleLinkClick}>
                <Settings />
                <span>Settings</span>
              </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
    </SidebarMenu>
  );
}
