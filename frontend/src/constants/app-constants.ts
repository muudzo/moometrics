import { AlertTriangle, LayoutDashboard, PawPrint, Users, type LucideIcon } from 'lucide-react';
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
];
