export const appSections = ['dashboard', 'crops', 'livestock', 'equipment', 'finance'] as const;

export type AppSection = (typeof appSections)[number];
