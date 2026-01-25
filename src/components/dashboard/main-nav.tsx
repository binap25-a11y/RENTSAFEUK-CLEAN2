'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Home,
  Wrench,
  CalendarCheck,
  Files,
  Settings,
} from 'lucide-react';

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/properties', label: 'Properties', icon: Home },
  { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/dashboard/inspections', label: 'Inspections', icon: CalendarCheck },
  { href: '/dashboard/documents', label: 'Documents', icon: Files },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {menuItems.map(({ href, label, icon: Icon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            asChild
            isActive={
              href === '/dashboard'
                ? pathname === href
                : pathname.startsWith(href)
            }
          >
            <Link href={href}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
       <SidebarMenuItem className="mt-auto">
          <SidebarMenuButton>
              <Settings />
              <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
    </SidebarMenu>
  );
}
