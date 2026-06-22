import {
  AlertTriangle,
  LayoutDashboard,
  PawPrint,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AppSection } from '@/types/navigation';

interface NavigationItem {
  title: string;
  icon: LucideIcon;
  component: AppSection;
  roles: ('manager' | 'employee')[];
}

export const navigationItems: NavigationItem[] = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    component: 'dashboard',
    roles: ['manager', 'employee'],
  },
  {
    title: 'Animals',
    icon: PawPrint,
    component: 'animals',
    roles: ['manager', 'employee'],
  },
  {
    title: 'Deaths',
    icon: AlertTriangle,
    component: 'deaths',
    roles: ['manager', 'employee'],
  },
  {
    title: 'Users',
    icon: Users,
    component: 'users',
    roles: ['manager'],
  },
  {
    title: 'Audit Log',
    icon: ScrollText,
    component: 'audit',
    roles: ['manager'],
  },
  {
    title: 'Settings',
    icon: Settings,
    component: 'settings',
    roles: ['manager', 'employee'],
  },
];
