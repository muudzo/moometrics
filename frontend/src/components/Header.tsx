import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SidebarTrigger } from './ui/sidebar';
import { MooMetricsLogo } from './MooMetricsLogo';
import { LocationSettings } from '@/features/settings/components/LocationSettings';
import { notifications } from '../constants/app-constants';
import { Bell, User, Menu, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  showNotifications: boolean;
  setShowNotifications: (show: boolean) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export function Header({
  showNotifications,
  setShowNotifications,
  darkMode,
  toggleDarkMode,
}: HeaderProps) {
  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden">
            <Menu className="w-5 h-5" />
          </SidebarTrigger>
          <div className="flex items-center gap-2 md:hidden">
            <MooMetricsLogo size={24} className="text-primary" />
            <span className="font-semibold text-foreground">MooMetrics</span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm text-muted-foreground">
              Welcome back to your MooMetrics dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Location Settings */}
          <LocationSettings />

          {/* Dark Mode Toggle */}
          <Button variant="ghost" size="sm" onClick={toggleDarkMode}>
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {notifications.length}
                </Badge>
              )}
            </Button>

            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-lg shadow-lg z-50">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-3 border-b border-border last:border-b-0"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-2 ${notification.type === 'critical'
                            ? 'bg-red-500'
                            : notification.type === 'warning'
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                            }`}
                        ></div>
                        <div className="flex-1">
                          <p className="text-sm">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full">
                    View All Notifications
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <Button variant="ghost" size="sm">
            <User className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
