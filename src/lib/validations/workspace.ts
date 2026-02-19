import { z } from 'zod';

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'ワークスペース名は必須です').max(50),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(50).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});
