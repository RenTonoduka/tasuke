import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'プロジェクト名は必須です').max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4285F4'),
  isPrivate: z.boolean().default(false),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  position: z.number().int().optional(),
});
