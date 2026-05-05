import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, handleApiError, errorResponse } from '@/lib/api-utils';
import { approveMeetingSchema } from '@/lib/validations/meeting';
import { assertMeetingAccess } from '@/lib/meeting/access';
import type { Priority } from '@prisma/client';

export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuthUser();
    const meetingMeta = await assertMeetingAccess(user.id, params.id);
    if (meetingMeta.status === 'APPROVED') {
      return errorResponse('既に承認済みです', 409);
    }

    const body = await req.json();
    const { items } = approveMeetingSchema.parse(body);

    const meeting = await prisma.meeting.findUnique({
      where: { id: params.id },
      include: { extractedTasks: true },
    });
    if (!meeting) return errorResponse('議事録が見つかりません', 404);

    const etById = new Map(meeting.extractedTasks.map((et) => [et.id, et]));

    // ID validation: workspace内のproject/section/userか確認
    const projectIds = new Set(
      (
        await prisma.project.findMany({
          where: { workspaceId: meeting.workspaceId },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    const allSections = await prisma.section.findMany({
      where: { project: { workspaceId: meeting.workspaceId } },
      select: { id: true, projectId: true, position: true },
      orderBy: { position: 'asc' },
    });
    const sectionToProject = new Map(allSections.map((s) => [s.id, s.projectId]));
    // プロジェクト先頭セクション（position最小）= Todo相当
    const defaultSectionByProject = new Map<string, string>();
    for (const s of allSections) {
      if (!defaultSectionByProject.has(s.projectId)) {
        defaultSectionByProject.set(s.projectId, s.id);
      }
    }
    const memberUserIds = new Set(
      (
        await prisma.workspaceMember.findMany({
          where: { workspaceId: meeting.workspaceId },
          select: { userId: true },
        })
      ).map((m) => m.userId),
    );

    const approvedDetails: { extractedTaskId: string; createdTaskId: string }[] = [];
    const rejectedIds: string[] = [];
    const skipped: { extractedTaskId: string; reason: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const et = etById.get(item.extractedTaskId);
        if (!et) {
          skipped.push({ extractedTaskId: item.extractedTaskId, reason: 'not found' });
          continue;
        }
        if (et.status === 'APPROVED' || et.status === 'REJECTED') {
          skipped.push({ extractedTaskId: et.id, reason: `already ${et.status}` });
          continue;
        }

        if (item.action === 'reject') {
          await tx.extractedTask.update({
            where: { id: et.id },
            data: { status: 'REJECTED' },
          });
          rejectedIds.push(et.id);
          continue;
        }

        // approve: 編集値を反映 → 検証 → Task作成
        const finalTitle = item.edits?.finalTitle ?? et.finalTitle ?? et.suggestedTitle;
        const finalDescription = item.edits?.finalDescription ?? et.finalDescription ?? et.suggestedDescription;
        const finalAssigneeId = item.edits?.finalAssigneeId ?? et.finalAssigneeId ?? et.suggestedAssigneeId;
        const finalProjectId = item.edits?.finalProjectId ?? et.finalProjectId ?? et.suggestedProjectId;
        const finalSectionId = item.edits?.finalSectionId ?? et.finalSectionId;
        const finalDueDateStr = item.edits?.finalDueDate;
        const finalDueDate = finalDueDateStr
          ? new Date(finalDueDateStr)
          : et.finalDueDate ?? et.suggestedDueDate;
        const finalPriority: Priority = (item.edits?.finalPriority ?? et.finalPriority ?? et.suggestedPriority) as Priority;

        if (!finalProjectId || !projectIds.has(finalProjectId)) {
          skipped.push({ extractedTaskId: et.id, reason: 'projectIdが未設定または無効' });
          continue;
        }

        let sectionId: string | null = null;
        if (finalSectionId) {
          const owner = sectionToProject.get(finalSectionId);
          if (owner === finalProjectId) sectionId = finalSectionId;
        }
        // 未指定 or 無効ならプロジェクト先頭セクション(Todo)に自動セット
        if (!sectionId) {
          sectionId = defaultSectionByProject.get(finalProjectId) ?? null;
        }

        if (finalAssigneeId && !memberUserIds.has(finalAssigneeId)) {
          skipped.push({ extractedTaskId: et.id, reason: 'assigneeIdがworkspaceメンバーでない' });
          continue;
        }

        const created = await tx.task.create({
          data: {
            title: finalTitle,
            description: finalDescription ?? null,
            priority: finalPriority,
            projectId: finalProjectId,
            sectionId,
            createdById: user.id,
            dueDate: finalDueDate ?? null,
            assignees: finalAssigneeId
              ? { create: [{ userId: finalAssigneeId }] }
              : undefined,
          },
          select: { id: true },
        });

        await tx.extractedTask.update({
          where: { id: et.id },
          data: {
            status: 'APPROVED',
            createdTaskId: created.id,
            finalTitle,
            finalDescription: finalDescription ?? null,
            finalAssigneeId: finalAssigneeId ?? null,
            finalProjectId,
            finalSectionId: sectionId,
            finalDueDate: finalDueDate ?? null,
            finalPriority,
          },
        });

        approvedDetails.push({ extractedTaskId: et.id, createdTaskId: created.id });
      }

      // Meeting status更新: 全ETが終結（APPROVED or REJECTED）したらMeetingもAPPROVED
      const remaining = await tx.extractedTask.count({
        where: { meetingId: meeting.id, status: 'PENDING' },
      });
      if (remaining === 0) {
        await tx.meeting.update({
          where: { id: meeting.id },
          data: { status: 'APPROVED', approvedAt: new Date() },
        });
      }
    });

    return successResponse({
      approved: approvedDetails,
      rejected: rejectedIds,
      skipped,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
