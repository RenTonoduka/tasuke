import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  return <>{children}</>;
}
