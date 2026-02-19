import { redirect, notFound } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AutomationsClient } from './client';

export default async function AutomationsPage({
  params,
}: {
  params: { workspaceSlug: string; projectId: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      workspace: {
        slug: params.workspaceSlug,
        members: { some: { userId: session.user.id } },
      },
    },
    select: { id: true, name: true },
  });

  if (!project) notFound();

  const rules = await prisma.automationRule.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: 'asc' },
  });

  const serialized = JSON.parse(JSON.stringify(rules));

  return (
    <AutomationsClient
      project={project}
      initialRules={serialized}
      workspaceSlug={params.workspaceSlug}
    />
  );
}
