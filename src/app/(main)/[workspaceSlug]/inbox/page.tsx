import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { InboxClient } from './client';

export default async function InboxPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const rawNotifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
  });
  const notifications = JSON.parse(JSON.stringify(rawNotifications));

  return (
    <>
      <Header title="インボックス" workspaceSlug={params.workspaceSlug} />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-2xl">
          <InboxClient initialNotifications={notifications} />
        </div>
      </div>
    </>
  );
}
