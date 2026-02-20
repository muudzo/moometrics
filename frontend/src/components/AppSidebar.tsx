import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import { navigationItems } from '../constants/app-constants';
import { MooMetricsLogo } from './MooMetricsLogo';
import { useAuth } from '@/features/auth/context/AuthContext';
import type { AppSection } from '@/types/navigation';

interface AppSidebarProps {
  activeComponent: AppSection;
  setActiveComponent: (component: AppSection) => void;
}

export function AppSidebar({ activeComponent, setActiveComponent }: AppSidebarProps) {
  const { user } = useAuth();

  const visibleItems = navigationItems.filter(
    (item) => user?.role && item.roles.includes(user.role),
  );

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <button
            onClick={() => setActiveComponent('dashboard')}
            className="flex items-center gap-3 w-full hover:bg-accent rounded-lg p-2 -m-2 transition-colors duration-200 group"
          >
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center group-hover:bg-primary/90 transition-colors duration-200">
              <MooMetricsLogo size={28} className="text-primary-foreground" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-foreground group-hover:text-accent-foreground">
                MooMetrics
              </h2>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Farm Records</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.component}>
                    <SidebarMenuButton
                      onClick={() => setActiveComponent(item.component)}
                      isActive={activeComponent === item.component}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
