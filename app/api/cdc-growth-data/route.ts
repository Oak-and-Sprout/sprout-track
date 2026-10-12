import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import {
  isValidGrowthStandard,
  type GrowthStandard,
} from '@/src/utils/growthStandard';
import {
  createGrowthReferenceSegments,
  type GrowthReferenceMeasurement,
  type GrowthReferenceRow,
  type GrowthReferenceSegment,
} from '@/src/utils/growthReferences';

export interface GrowthReferenceDataResponse {
  standard: GrowthStandard;
  measurementType: GrowthReferenceMeasurement;
  segments: GrowthReferenceSegment[];
}

const MEASUREMENT_TYPES: readonly GrowthReferenceMeasurement[] = [
  'weight',
  'length',
  'head_circumference',
];

function isValidMeasurementType(value: string | null): value is GrowthReferenceMeasurement {
  return value !== null && MEASUREMENT_TYPES.includes(value as GrowthReferenceMeasurement);
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const sex = searchParams.get('sex'); // 1 = Male, 2 = Female
    const measurementTypeParam = searchParams.get('type'); // weight, length, head_circumference
    const standardParam = (searchParams.get('standard') || 'CDC').toUpperCase(); // CDC or WHO

    if (!isValidGrowthStandard(standardParam)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'standard must be CDC or WHO' },
        { status: 400 },
      );
    }

    if (!sex || !isValidMeasurementType(measurementTypeParam)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'sex and a valid type (weight, length, or head_circumference) are required',
        },
        { status: 400 },
      );
    }

    const sexNum = parseInt(sex, 10);
    if (sexNum !== 1 && sexNum !== 2) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'sex must be 1 (Male) or 2 (Female)' },
        { status: 400 },
      );
    }

    const standard = standardParam;
    const measurementType = measurementTypeParam;
    const selectFields = {
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
    } as const;

    let primaryRows: GrowthReferenceRow[];
    let childRows: GrowthReferenceRow[] = [];

    if (standard === 'WHO') {
      switch (measurementType) {
        case 'weight':
          primaryRows = await prisma.whoWeightForAge.findMany({
            where: { sex: sexNum },
            orderBy: { ageMonths: 'asc' },
            select: selectFields,
          });
          break;
        case 'length':
          primaryRows = await prisma.whoLengthForAge.findMany({
            where: { sex: sexNum },
            orderBy: { ageMonths: 'asc' },
            select: selectFields,
          });
          break;
        case 'head_circumference':
          primaryRows = await prisma.whoHeadCircumferenceForAge.findMany({
            where: { sex: sexNum },
            orderBy: { ageMonths: 'asc' },
            select: selectFields,
          });
          break;
      }
    } else {
      switch (measurementType) {
        case 'weight':
          [primaryRows, childRows] = await Promise.all([
            prisma.cdcWeightForAge.findMany({
              where: { sex: sexNum },
              orderBy: { ageMonths: 'asc' },
              select: selectFields,
            }),
            prisma.cdcChildWeightForAge.findMany({
              where: { sex: sexNum },
              orderBy: { ageMonths: 'asc' },
              select: selectFields,
            }),
          ]);
          break;
        case 'length':
          [primaryRows, childRows] = await Promise.all([
            prisma.cdcLengthForAge.findMany({
              where: { sex: sexNum },
              orderBy: { ageMonths: 'asc' },
              select: selectFields,
            }),
            prisma.cdcStatureForAge.findMany({
              where: { sex: sexNum },
              orderBy: { ageMonths: 'asc' },
              select: selectFields,
            }),
          ]);
          break;
        case 'head_circumference':
          primaryRows = await prisma.cdcHeadCircumferenceForAge.findMany({
            where: { sex: sexNum },
            orderBy: { ageMonths: 'asc' },
            select: selectFields,
          });
          break;
      }
    }

    const segments = createGrowthReferenceSegments(
      standard,
      measurementType,
      primaryRows,
      childRows,
    );

    return NextResponse.json<ApiResponse<GrowthReferenceDataResponse>>(
      { success: true, data: { standard, measurementType, segments } },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    );
  } catch (error) {
    console.error('Error fetching growth reference data:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch growth reference data' },
      { status: 500 },
    );
  }
}

export const GET = withAuthContext(
  handleGet as (
    req: NextRequest,
    authContext: AuthResult,
  ) => Promise<NextResponse<ApiResponse<any>>>,
);
