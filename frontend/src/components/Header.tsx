import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SidebarTrigger } from './ui/sidebar';
import { MooMetricsLogo } from './MooMetricsLogo';
import { LogOut, Sun, Moon, Menu } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export function Header({ darkMode, toggleDarkMode }: HeaderProps) {
  const { user, logout } = useAuth();

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
        </div>

        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <Button variant="ghost" size="sm" onClick={toggleDarkMode} aria-label="Toggle dark mode">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* User Info */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end leading-tight">
                <span className="text-sm font-medium">{user.username}</span>
                <span className="text-xs text-muted-foreground">{user.farmName}</span>
              </div>
              <Badge
                variant={user.role === 'manager' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {user.role}
              </Badge>
            </div>
          )}

          {/* Logout */}
          <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
