import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, FamilyResponse, FamilyCreate, FamilyUpdate } from '../../types';
import { withSysAdminAuth } from '../../utils/auth';

// GET - Get all families (including inactive ones) for management
async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<FamilyResponse[]>>> {
  try {
    const families = await prisma.family.findMany({
      orderBy: [
        { isActive: 'desc' }, // Active families first
        { name: 'asc' }       // Then alphabetical by name
      ],
      include: {
        _count: {
          select: {
            caretakers: true,
            babies: true
          }
        }
      }
    });

    // Get the most recent entry date per family across all log tables
    // Uses Prisma queries for cross-database compatibility (SQLite + PostgreSQL)
    const familyIds = families.map(f => f.id);
    const logModels = [
      prisma.sleepLog, prisma.feedLog, prisma.diaperLog, prisma.moodLog,
      prisma.note, prisma.bathLog, prisma.pumpLog, prisma.playLog,
      prisma.medicineLog, prisma.measurement,
    ] as const;

    const lastEntryPromises = familyIds.map(async (familyId) => {
      const results = await Promise.all(
        logModels.map((model) =>
          (model as any).findFirst({
            where: { familyId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })
        )
      );
      const dates = results
        .filter((r: any) => r?.createdAt)
        .map((r: any) => new Date(r.createdAt).getTime());
      return { familyId, lastEntryAt: dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null };
    });

    const lastEntryResults = await Promise.all(lastEntryPromises);
    const lastEntryMap = new Map<string, string>();
    for (const { familyId, lastEntryAt } of lastEntryResults) {
      if (lastEntryAt) lastEntryMap.set(familyId, lastEntryAt);
    }

    // Convert to response format with counts
    const familyResponses = families.map((family) => ({
      id: family.id,
      name: family.name,
      slug: family.slug,
      isActive: family.isActive,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
      lastEntryAt: lastEntryMap.get(family.id) || null,
      caretakerCount: family._count.caretakers,
      babyCount: family._count.babies,
    }));

    return NextResponse.json({
      success: true,
      data: familyResponses,
    });
  } catch (error) {
    console.error('Error fetching families for management:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch families',
    }, { status: 500 });
  }
}

// POST - Create a new family
async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<FamilyResponse>>> {
  try {
    const body: FamilyCreate = await req.json();

    // Validate required fields
    if (!body.name || !body.slug) {
      return NextResponse.json({
        success: false,
        error: 'Name and slug are required',
      }, { status: 400 });
    }

    // Check if slug already exists
    const existingFamily = await prisma.family.findUnique({
      where: { slug: body.slug }
    });

    if (existingFamily) {
      return NextResponse.json({
        success: false,
        error: 'Slug already exists',
      }, { status: 400 });
    }

    const family = await prisma.family.create({
      data: {
        name: body.name,
        slug: body.slug,
        isActive: body.isActive ?? true
      }
    });

    const response: FamilyResponse = {
      id: family.id,
      name: family.name,
      slug: family.slug,
      isActive: family.isActive,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating family:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create family',
    }, { status: 500 });
  }
}

// PUT - Update an existing family
async function putHandler(req: NextRequest): Promise<NextResponse<ApiResponse<FamilyResponse>>> {
  try {
    const body: FamilyUpdate = await req.json();

    if (!body.id) {
      return NextResponse.json({
        success: false,
        error: 'Family ID is required',
      }, { status: 400 });
    }

    // Check if family exists
    const existingFamily = await prisma.family.findUnique({
      where: { id: body.id }
    });

    if (!existingFamily) {
      return NextResponse.json({
        success: false,
        error: 'Family not found',
      }, { status: 404 });
    }

    // If slug is being updated, check if it already exists (excluding current family)
    if (body.slug && body.slug !== existingFamily.slug) {
      const slugExists = await prisma.family.findFirst({
        where: { 
          slug: body.slug,
          id: { not: body.id }
        }
      });

      if (slugExists) {
        return NextResponse.json({
          success: false,
          error: 'Slug already exists',
        }, { status: 400 });
      }
    }

    const { id, ...updateData } = body;
    const family = await prisma.family.update({
      where: { id },
      data: updateData
    });

    const response: FamilyResponse = {
      id: family.id,
      name: family.name,
      slug: family.slug,
      isActive: family.isActive,
      createdAt: family.createdAt.toISOString(),
      updatedAt: family.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating family:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update family',
    }, { status: 500 });
  }
}

// Export handlers with sysadmin authentication
export const GET = withSysAdminAuth(getHandler);
export const POST = withSysAdminAuth(postHandler);
export const PUT = withSysAdminAuth(putHandler); 