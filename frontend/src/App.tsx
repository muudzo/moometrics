import { useState } from 'react';
import { SidebarProvider } from './components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Header } from './components/Header';
import { AuthProvider, useAuth } from './features/auth/context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { Login } from './features/auth/components/Login';
import { renderSection } from './app/section-registry';
import type { AppSection } from './types/navigation';

function AppContent() {
  const [activeComponent, setActiveComponent] = useState<AppSection>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen bg-background ${darkMode ? 'dark' : ''}`}>
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} />

          <div className="flex-1 flex flex-col">
            <Header
              showNotifications={showNotifications}
              setShowNotifications={setShowNotifications}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />

            <main className="flex-1 overflow-auto bg-background">
              {renderSection(activeComponent, { onNavigate: setActiveComponent })}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <AppContent />
      </LocationProvider>
    </AuthProvider>
  );
}
