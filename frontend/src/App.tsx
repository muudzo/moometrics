import { useState } from 'react';
import { SidebarProvider } from './components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Header } from './components/Header';
import { AuthProvider, useAuth } from './features/auth/context/AuthContext';
import { Login } from './features/auth/components/Login';
import { OfflineBanner } from './components/OfflineBanner';
import { renderSection } from './app/section-registry';
import type { AppSection } from './types/navigation';

function AppContent() {
  const [activeComponent, setActiveComponent] = useState<AppSection>('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <>
        <OfflineBanner />
        <Login />
      </>
    );
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className={`min-h-screen bg-background ${darkMode ? 'dark' : ''}`}>
      <OfflineBanner />
      <SidebarProvider>
        <div className="flex h-screen">
          <AppSidebar activeComponent={activeComponent} setActiveComponent={setActiveComponent} />

          <div className="flex-1 flex flex-col overflow-hidden">
            <Header darkMode={darkMode} toggleDarkMode={toggleDarkMode} />

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
      <AppContent />
    </AuthProvider>
  );
}
