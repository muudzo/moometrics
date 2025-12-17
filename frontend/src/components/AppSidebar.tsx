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
import { ArrowLeft, Settings, User } from 'lucide-react';

interface AppSidebarProps {
  activeComponent: string;
  setActiveComponent: (component: string) => void;
}

export function AppSidebar({ activeComponent, setActiveComponent }: AppSidebarProps) {
  const handleBackToDashboard = () => {
    setActiveComponent('dashboard');
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        {/* Back Button / Logo */}
        <div className="p-6 border-b border-border">
          <button
            onClick={handleBackToDashboard}
            className="flex items-center gap-3 w-full hover:bg-accent rounded-lg p-2 -m-2 transition-colors duration-200 group"
          >
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center group-hover:bg-primary/90 transition-colors duration-200">
              <MooMetricsLogo size={28} className="text-primary-foreground" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-foreground group-hover:text-accent-foreground">
                MooMetrics
              </h2>
              <p className="text-xs text-muted-foreground">Back to Dashboard</p>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Farm Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
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

        {/* Settings */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <User className="w-4 h-4" />
                  <span>Profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
