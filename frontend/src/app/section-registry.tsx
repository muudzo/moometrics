import { Dashboard } from '@/features/dashboard/components/Dashboard';
import { CropManagement } from '@/features/crops/components/CropManagement';
import { LivestockManagement } from '@/features/livestock/components/LivestockManagement';
import { EquipmentTracking } from '@/features/equipment/components/EquipmentTracking';
import { FinanceTracking } from '@/features/finance/components/FinanceTracking';
import type { ReactNode } from 'react';
import type { AppSection } from '@/types/navigation';

type SectionRendererProps = {
  onNavigate: (section: AppSection) => void;
};

type SectionRenderer = (props: SectionRendererProps) => ReactNode;

const sectionRegistry: Record<AppSection, SectionRenderer> = {
  dashboard: ({ onNavigate }) => <Dashboard onNavigate={onNavigate} />,
  crops: () => <CropManagement />,
  livestock: () => <LivestockManagement />,
  equipment: () => <EquipmentTracking />,
  finance: () => <FinanceTracking />,
};

export function renderSection(section: AppSection, props: SectionRendererProps) {
  return sectionRegistry[section](props);
}
