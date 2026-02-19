import { z } from 'zod';

export const triggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('STATUS_CHANGE'),
    from: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']).optional(),
    to: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'ARCHIVED']),
  }),
  z.object({
    type: z.literal('PRIORITY_CHANGE'),
    to: z.enum(['P0', 'P1', 'P2', 'P3']),
  }),
  z.object({
    type: z.literal('DUE_DATE_APPROACHING'),
    daysBefore: z.number().int().min(1).max(30),
  }),
]);

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NOTIFY_ASSIGNEES'), message: z.string().max(200).optional() }),
  z.object({ type: z.literal('SET_PRIORITY'), priority: z.enum(['P0', 'P1', 'P2', 'P3']) }),
  z.object({ type: z.literal('MOVE_SECTION'), sectionName: z.string().min(1).max(100) }),
  z.object({ type: z.literal('ADD_LABEL'), labelName: z.string().min(1).max(50) }),
]);

export const createRuleSchema = z.object({
  name: z.string().min(1, 'ルール名は必須です').max(100),
  trigger: triggerSchema,
  action: actionSchema,
});

export const patchRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  trigger: triggerSchema.optional(),
  action: actionSchema.optional(),
});
