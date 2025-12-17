import { useState } from 'react';
import { SidebarProvider } from './components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Header } from './components/Header';
import { Dashboard } from './features/dashboard/components/Dashboard';
import { CropManagement } from '@/features/crops/components/CropManagement';
import { LivestockManagement } from '@/features/livestock/components/LivestockManagement';
import { EquipmentTracking } from '@/features/equipment/components/EquipmentTracking';
import { FinanceTracking } from '@/features/finance/components/FinanceTracking';
import { AuthProvider, useAuth } from './features/auth/context/AuthContext';
import { LocationProvider } from './context/LocationContext';
import { Login } from './features/auth/components/Login';

function AppContent() {
  const [activeComponent, setActiveComponent] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }



  const renderComponent = () => {
    switch (activeComponent) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveComponent} />;
      case 'crops':
        return <CropManagement />;
      case 'livestock':
        return <LivestockManagement />;
      case 'equipment':
        return <EquipmentTracking />;
      case 'finance':
        return <FinanceTracking />;
      default:
        return <Dashboard onNavigate={setActiveComponent} />;
    }
  };

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

            <main className="flex-1 overflow-auto bg-background">{renderComponent()}</main>
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
