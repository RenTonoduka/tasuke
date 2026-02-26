import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です').max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).default('P3'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).default('TODO'),
  sectionId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
  sectionId: z.string().optional().nullable(),
  projectId: z.string().optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().min(0.5).max(100).multipleOf(0.5).optional().nullable(),
  position: z.number().optional(),
});

export const moveTaskSchema = z.object({
  sectionId: z.string().nullable(),
  position: z.number(),
});
