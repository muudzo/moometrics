import { Dashboard } from '@/features/dashboard/components/Dashboard';
import { AnimalManagement } from '@/features/animals/components/AnimalManagement';
import { DeathManagement } from '@/features/deaths/components/DeathManagement';
import { UserManagement } from '@/features/users/components/UserManagement';
import { AuditLog } from '@/features/audit/components/AuditLog';
import { Settings } from '@/features/settings/components/Settings';
import type { ReactNode } from 'react';
import type { AppSection } from '@/types/navigation';

type SectionRendererProps = {
  onNavigate: (section: AppSection) => void;
};

type SectionRenderer = (props: SectionRendererProps) => ReactNode;

const sectionRegistry: Record<AppSection, SectionRenderer> = {
  dashboard: () => <Dashboard />,
  animals: () => <AnimalManagement />,
  deaths: () => <DeathManagement />,
  users: () => <UserManagement />,
  audit: () => <AuditLog />,
  settings: () => <Settings />,
};

export function renderSection(section: AppSection, props: SectionRendererProps) {
  return sectionRegistry[section](props);
}
