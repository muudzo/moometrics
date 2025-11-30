import { useState } from 'react';
import { SidebarProvider } from './components/ui/sidebar';
import { AppSidebar } from './components/AppSidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { CropManagement } from './components/CropManagement';
import { LivestockManagement } from './components/LivestockManagement';
import { EquipmentTracking } from './components/EquipmentTracking';
import { FinanceTracking } from './components/FinanceTracking';

export default function App() {
  const [activeComponent, setActiveComponent] = useState("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Farm data state for first-time user experience
  const [farmData, setFarmData] = useState({
    crops: [],
    livestock: [],
    equipment: [],
    transactions: []
  });

  const handleNavigate = (section: string) => {
    setActiveComponent(section);
  };

  const renderComponent = () => {
    switch (activeComponent) {
      case "dashboard":
        return <Dashboard farmData={farmData} onNavigate={handleNavigate} />;
      case "crops":
        return <CropManagement farmData={farmData} setFarmData={setFarmData} />;
      case "livestock":
        return <LivestockManagement farmData={farmData} setFarmData={setFarmData} />;
      case "equipment":
        return <EquipmentTracking farmData={farmData} setFarmData={setFarmData} />;
      case "finance":
        return <FinanceTracking farmData={farmData} setFarmData={setFarmData} />;
      default:
        return <Dashboard farmData={farmData} onNavigate={handleNavigate} />;
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
          <AppSidebar 
            activeComponent={activeComponent} 
            setActiveComponent={setActiveComponent} 
          />

          <div className="flex-1 flex flex-col">
            <Header
              showNotifications={showNotifications}
              setShowNotifications={setShowNotifications}
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
            />

            <main className="flex-1 overflow-auto bg-background">
              {renderComponent()}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}