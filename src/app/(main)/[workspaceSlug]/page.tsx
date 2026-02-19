import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Header } from '@/components/layout/header';

export default async function WorkspacePage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect('/login');

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      projects: {
        orderBy: { position: 'asc' },
        include: { _count: { select: { tasks: true } } },
      },
    },
  });

  if (!workspace) redirect('/');

  return (
    <>
      <Header title="ダッシュボード" />
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspace.projects.map((project) => (
            <a
              key={project.id}
              href={`/${params.workspaceSlug}/projects/${project.id}`}
              className="rounded-lg border border-[#E8EAED] p-4 transition-colors hover:bg-[#F8F9FA]"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <h3 className="font-medium text-[#202124]">{project.name}</h3>
              </div>
              <p className="mt-2 text-sm text-[#5F6368]">
                {project._count.tasks} タスク
              </p>
            </a>
          ))}
        </div>
        {workspace.projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[#5F6368]">プロジェクトがまだありません</p>
            <p className="mt-1 text-sm text-[#80868B]">
              サイドバーの + ボタンから作成してください
            </p>
          </div>
        )}
      </div>
    </>
  );
}
