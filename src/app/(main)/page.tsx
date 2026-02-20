import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function HomePage() {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });

  if (membership?.workspace) {
    redirect(`/${membership.workspace.slug}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-g-text-secondary">ワークスペースを作成してください</p>
    </div>
  );
}
