import { z } from 'zod';

export const extractMeetingSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(300),
  transcript: z.string().min(10, '本文が短すぎます').max(50000, '本文が長すぎます（5万字以内）'),
  meetingDate: z.string().datetime().optional().nullable(),
  attendees: z
    .array(
      z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      }),
    )
    .optional(),
  source: z.enum(['MANUAL_PASTE', 'DRIVE_WATCH', 'WEB_QUICK_CAPTURE', 'LINE_QUICK']).optional(),
});

export const patchExtractedTaskSchema = z.object({
  finalTitle: z.string().min(1).max(200).optional(),
  finalDescription: z.string().max(5000).optional().nullable(),
  finalAssigneeId: z.string().optional().nullable(),
  finalProjectId: z.string().optional().nullable(),
  finalSectionId: z.string().optional().nullable(),
  finalDueDate: z.string().datetime().optional().nullable(),
  finalPriority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
});

export const approveItemSchema = z.object({
  extractedTaskId: z.string(),
  action: z.enum(['approve', 'reject']),
  edits: patchExtractedTaskSchema.optional(),
});

export const approveMeetingSchema = z.object({
  items: z.array(approveItemSchema).min(1),
});

export type ExtractMeetingInput = z.infer<typeof extractMeetingSchema>;
export type ApproveMeetingInput = z.infer<typeof approveMeetingSchema>;
export type ApproveItem = z.infer<typeof approveItemSchema>;
