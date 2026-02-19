import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { successResponse, handleApiError } from '@/lib/api-utils';

const createLabelSchema = z.object({
  name: z.string().min(1).max(30),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4285F4'),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    const labels = await prisma.label.findMany({
      where: { workspaceId: params.id },
      orderBy: { name: 'asc' },
    });
    return successResponse(labels);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAuthUser();
    const body = await req.json();
    const data = createLabelSchema.parse(body);

    const label = await prisma.label.create({
      data: {
        ...data,
        workspaceId: params.id,
      },
    });

    return successResponse(label, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
