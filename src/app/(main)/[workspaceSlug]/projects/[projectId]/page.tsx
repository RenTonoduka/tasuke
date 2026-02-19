import { redirect, notFound } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ProjectPageClient } from './client';

export default async function ProjectPage({
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
    include: {
      sections: {
        orderBy: { position: 'asc' },
        include: {
          tasks: {
            where: { parentId: null },
            orderBy: { position: 'asc' },
            include: {
              assignees: {
                include: { user: { select: { id: true, name: true, image: true } } },
              },
              labels: { include: { label: true } },
              _count: { select: { subtasks: true } },
            },
          },
        },
      },
    },
  });

  if (!project) notFound();

  return <ProjectPageClient project={project} />;
}
