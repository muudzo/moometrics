export const appSections = [
  'dashboard',
  'animals',
  'deaths',
  'users',
  'audit',
  'settings',
] as const;
export type AppSection = (typeof appSections)[number];
