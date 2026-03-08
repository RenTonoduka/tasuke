import { redirect } from 'next/navigation';

export default function AllProjectsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  redirect(`/${params.workspaceSlug}`);
}
