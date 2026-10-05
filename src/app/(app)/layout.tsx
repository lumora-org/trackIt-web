import { AuthenticatedLayout } from '@/components/shell/require-auth';

/**
 * Every authenticated screen lives under this group, so the guard and shell are
 * applied once. Route groups do not affect the URL, so these are still `/dashboard`,
 * `/sales`, and so on.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
