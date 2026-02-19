import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { successResponse, handleApiError } from '@/lib/api-utils';

const updateSectionSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    const body = await req.json();
    const data = updateSectionSchema.parse(body);
    const section = await prisma.section.update({
      where: { id: params.id },
      data,
    });
    return successResponse(section);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    await prisma.section.delete({ where: { id: params.id } });
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
