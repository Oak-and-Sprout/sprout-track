import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

// CDC growth data record type
export interface CdcGrowthDataRecord {
  sex: number;
  ageMonths: number;
  l: number;
  m: number;
  s: number;
  p3: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p97: number;
}

type MeasurementTypeParam = 'weight' | 'length' | 'head_circumference';

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const sex = searchParams.get('sex'); // 1 = Male, 2 = Female
    const measurementType = searchParams.get('type') as MeasurementTypeParam | null; // weight, length, head_circumference

    if (!sex || !measurementType) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'sex and type parameters are required' },
        { status: 400 }
      );
    }

    const sexNum = parseInt(sex, 10);
    if (sexNum !== 1 && sexNum !== 2) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'sex must be 1 (Male) or 2 (Female)' },
        { status: 400 }
      );
    }

    let data: CdcGrowthDataRecord[];

    switch (measurementType) {
      case 'weight':
        data = await prisma.cdcWeightForAge.findMany({
          where: { sex: sexNum },
          orderBy: { ageMonths: 'asc' },
          select: {
            sex: true,
            ageMonths: true,
            l: true,
            m: true,
            s: true,
            p3: true,
            p5: true,
            p10: true,
            p25: true,
            p50: true,
            p75: true,
            p90: true,
            p95: true,
            p97: true,
          },
        });
        break;
      case 'length':
        data = await prisma.cdcLengthForAge.findMany({
          where: { sex: sexNum },
          orderBy: { ageMonths: 'asc' },
          select: {
            sex: true,
            ageMonths: true,
            l: true,
            m: true,
            s: true,
            p3: true,
            p5: true,
            p10: true,
            p25: true,
            p50: true,
            p75: true,
            p90: true,
            p95: true,
            p97: true,
          },
        });
        break;
      case 'head_circumference':
        data = await prisma.cdcHeadCircumferenceForAge.findMany({
          where: { sex: sexNum },
          orderBy: { ageMonths: 'asc' },
          select: {
            sex: true,
            ageMonths: true,
            l: true,
            m: true,
            s: true,
            p3: true,
            p5: true,
            p10: true,
            p25: true,
            p50: true,
            p75: true,
            p90: true,
            p95: true,
            p97: true,
          },
        });
        break;
      default:
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Invalid measurement type. Use: weight, length, or head_circumference' },
          { status: 400 }
        );
    }

    return NextResponse.json<ApiResponse<CdcGrowthDataRecord[]>>({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching CDC growth data:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch CDC growth data' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
