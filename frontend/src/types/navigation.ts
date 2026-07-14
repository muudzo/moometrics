export const appSections = [
  'dashboard',
  'animals',
  'deaths',
  'feed',
  'users',
  'audit',
  'settings',
] as const;
export type AppSection = (typeof appSections)[number];
