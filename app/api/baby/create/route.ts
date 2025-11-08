import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/prisma/db';
import { z } from 'zod';
import { ApiResponse, getAuthenticatedUser } from '@/app/api/utils/auth';
import { checkWritePermission } from '@/app/api/utils/writeProtection';
import { Baby, Gender } from '@prisma/client';

const CreateBabySchema = z.object({
  familyId: z.string(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  birthDate: z.string().datetime(),
  gender: z.nativeEnum(Gender),
  feedWarningTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  diaperWarningTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
});

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Baby>>> {
  // Check authentication and write permissions for expired accounts
  const authContext = await getAuthenticatedUser(req);
  if (!authContext.authenticated) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const body = await req.json();
    const validation = CreateBabySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { familyId, ...babyData } = validation.data;
    
    // Verify family exists
    const family = await prisma.family.findUnique({
        where: { id: familyId }
    });

    if (!family) {
        return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
    }

    const newBaby = await prisma.baby.create({
      data: {
        ...babyData,
        birthDate: new Date(babyData.birthDate),
        family: {
            connect: { id: familyId }
        }
      },
    });

    return NextResponse.json({ success: true, data: newBaby }, { status: 201 });
  } catch (error) {
    console.error('Error creating baby:', error);
    // Add type guard for ZodError if you want to return specific validation errors
    if (error instanceof z.ZodError) {
        return NextResponse.json({ success: false, error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: 'Error creating baby' }, { status: 500 });
  }
} 