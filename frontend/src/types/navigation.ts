export const appSections = ['dashboard', 'animals', 'deaths', 'users'] as const;
export type AppSection = (typeof appSections)[number];
