import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { toUTC, formatForResponse } from '../../utils/timezone';
import * as ExcelJS from 'exceljs';

/**
 * Handle GET request to export vaccine logs as an Excel file
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const babyId = searchParams.get('babyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!babyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Baby ID is required' },
        { status: 400 }
      );
    }

    // Verify baby belongs to family
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Baby not found in this family.' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = {
      familyId: userFamilyId,
      babyId,
      ...(startDate && endDate && {
        time: {
          gte: toUTC(startDate),
          lte: toUTC(endDate),
        },
      }),
    };

    const vaccineLogs = await prisma.vaccineLog.findMany({
      where,
      include: {
        documents: true,
        contacts: {
          include: {
            contact: true,
          },
        },
      },
      orderBy: { time: 'desc' },
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Vaccine Records');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Vaccine Name', key: 'vaccineName', width: 25 },
      { header: 'Dose #', key: 'doseNumber', width: 10 },
      { header: 'Doctor/Contact', key: 'contact', width: 25 },
      { header: 'Notes', key: 'notes', width: 40 },
      { header: 'Has Documents', key: 'hasDocuments', width: 15 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };

    for (const log of vaccineLogs) {
      const contactNames = log.contacts
        .map(c => c.contact.name)
        .join(', ');

      worksheet.addRow({
        date: formatForResponse(log.time) || '',
        vaccineName: log.vaccineName,
        doseNumber: log.doseNumber || '',
        contact: contactNames,
        notes: log.notes || '',
        hasDocuments: log.documents.length > 0 ? 'Y' : 'N',
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `vaccine-records-${baby.firstName || 'baby'}-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting vaccine logs:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to export vaccine logs',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const GET = withAuthContext(handleGet as any);
