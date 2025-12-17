import { LayoutDashboard, Wheat, PawPrint, Tractor, DollarSign } from 'lucide-react';

export const navigationItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    component: 'dashboard',
  },
  {
    title: 'Crop Management',
    icon: Wheat,
    component: 'crops',
  },
  {
    title: 'Livestock',
    icon: PawPrint,
    component: 'livestock',
  },
  {
    title: 'Equipment',
    icon: Tractor,
    component: 'equipment',
  },
  {
    title: 'Finance & Sales',
    icon: DollarSign,
    component: 'finance',
  },
];

export const notifications = [
  {
    id: 1,
    message: 'Harvest due for South Field B (Wheat)',
    type: 'critical',
    time: '2 hours ago',
  },
  {
    id: 2,
    message: 'Cattle health check scheduled tomorrow',
    type: 'info',
    time: '4 hours ago',
  },
  {
    id: 3,
    message: 'Equipment maintenance required (Kubota M5-171)',
    type: 'warning',
    time: '1 day ago',
  },
];
