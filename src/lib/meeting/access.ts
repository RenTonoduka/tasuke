import prisma from '@/lib/prisma';

export async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) {
    const err = new Error('ワークスペースへのアクセス権がありません');
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return member;
}

export async function assertMeetingAccess(userId: string, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, workspaceId: true, status: true, createdById: true },
  });
  if (!meeting) {
    const err = new Error('議事録が見つかりません');
    (err as Error & { status?: number }).status = 404;
    throw err;
  }
  await assertWorkspaceAccess(userId, meeting.workspaceId);
  return meeting;
}
