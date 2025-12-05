import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { createDataExport } from '../../utils/csv-export';

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { accountId, isAccountAuth, familyId } = authContext;
    
    if (!isAccountAuth || !accountId || !familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Account authentication and family association required' },
        { status: 403 }
      );
    }

    // Get family information
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      include: {
        account: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            verified: true,
            betaparticipant: true,
            createdAt: true,
          }
        }
      }
    });

    if (!family) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Family not found' },
        { status: 404 }
      );
    }

    // Fetch all family data
    const [
      babies,
      caretakers,
      contacts,
      sleepLogs,
      feedLogs,
      diaperLogs,
      moodLogs,
      notes,
      milestones,
      pumpLogs,
      playLogs,
      bathLogs,
      measurements,
      medicines,
      medicineLogs,
      calendarEvents,
      settings
    ] = await Promise.all([
      prisma.baby.findMany({ where: { familyId } }),
      prisma.caretaker.findMany({ where: { familyId } }),
      prisma.contact.findMany({ where: { familyId } }),
      prisma.sleepLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.feedLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.diaperLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.moodLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.note.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.milestone.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.pumpLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.playLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.bathLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.measurement.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } } } }),
      prisma.medicine.findMany({ where: { familyId } }),
      prisma.medicineLog.findMany({ where: { familyId }, include: { baby: { select: { firstName: true, lastName: true } }, caretaker: { select: { name: true } }, medicine: { select: { name: true } } } }),
      prisma.calendarEvent.findMany({ where: { familyId }, include: { babies: { include: { baby: { select: { firstName: true, lastName: true } } } }, caretakers: { include: { caretaker: { select: { name: true } } } }, contacts: { include: { contact: { select: { name: true, role: true } } } } } }),
      prisma.settings.findFirst({ where: { familyId } })
    ]);

    // Prepare family info
    const familyInfo = {
      family: {
        id: family.id,
        name: family.name,
        slug: family.slug,
        isActive: family.isActive,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      },
      account: family.account,
      exportDate: new Date().toISOString(),
      totalRecords: {
        babies: babies.length,
        caretakers: caretakers.length,
        contacts: contacts.length,
        sleepLogs: sleepLogs.length,
        feedLogs: feedLogs.length,
        diaperLogs: diaperLogs.length,
        moodLogs: moodLogs.length,
        notes: notes.length,
        milestones: milestones.length,
        pumpLogs: pumpLogs.length,
        playLogs: playLogs.length,
        bathLogs: bathLogs.length,
        measurements: measurements.length,
        medicines: medicines.length,
        medicineLogs: medicineLogs.length,
        calendarEvents: calendarEvents.length,
      }
    };

    // Prepare data for export (flatten related data)
    const exportData = {
      familyInfo,
      babies: babies.map(b => ({ ...b, securityPin: undefined })),
      caretakers: caretakers.map(c => ({ ...c, securityPin: '[REDACTED]' })),
      contacts,
      sleepLogs: sleepLogs.map(s => ({
        ...s,
        babyName: s.baby ? `${s.baby.firstName} ${s.baby.lastName}` : '',
        caretakerName: s.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      feedLogs: feedLogs.map(f => ({
        ...f,
        babyName: f.baby ? `${f.baby.firstName} ${f.baby.lastName}` : '',
        caretakerName: f.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      diaperLogs: diaperLogs.map(d => ({
        ...d,
        babyName: d.baby ? `${d.baby.firstName} ${d.baby.lastName}` : '',
        caretakerName: d.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      moodLogs: moodLogs.map(m => ({
        ...m,
        babyName: m.baby ? `${m.baby.firstName} ${m.baby.lastName}` : '',
        caretakerName: m.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      notes: notes.map(n => ({
        ...n,
        babyName: n.baby ? `${n.baby.firstName} ${n.baby.lastName}` : '',
        caretakerName: n.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      milestones: milestones.map(m => ({
        ...m,
        babyName: m.baby ? `${m.baby.firstName} ${m.baby.lastName}` : '',
        caretakerName: m.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      pumpLogs: pumpLogs.map(p => ({
        ...p,
        babyName: p.baby ? `${p.baby.firstName} ${p.baby.lastName}` : '',
        caretakerName: p.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      playLogs: playLogs.map(p => ({
        ...p,
        babyName: p.baby ? `${p.baby.firstName} ${p.baby.lastName}` : '',
        caretakerName: p.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      bathLogs: bathLogs.map(b => ({
        ...b,
        babyName: b.baby ? `${b.baby.firstName} ${b.baby.lastName}` : '',
        caretakerName: b.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      measurements: measurements.map(m => ({
        ...m,
        babyName: m.baby ? `${m.baby.firstName} ${m.baby.lastName}` : '',
        caretakerName: m.caretaker?.name || '',
        baby: undefined,
        caretaker: undefined
      })),
      medicines,
      medicineLogs: medicineLogs.map(m => ({
        ...m,
        babyName: m.baby ? `${m.baby.firstName} ${m.baby.lastName}` : '',
        caretakerName: m.caretaker?.name || '',
        medicineName: m.medicine?.name || '',
        baby: undefined,
        caretaker: undefined,
        medicine: undefined
      })),
      calendarEvents: calendarEvents.map(e => ({
        ...e,
        associatedBabies: e.babies.map(b => `${b.baby.firstName} ${b.baby.lastName}`).join('; '),
        associatedCaretakers: e.caretakers.map(c => c.caretaker.name).join('; '),
        associatedContacts: e.contacts.map(c => `${c.contact.name} (${c.contact.role})`).join('; '),
        babies: undefined,
        caretakers: undefined,
        contacts: undefined
      })),
      settings
    };

    // Create the data export
    const dataExport = await createDataExport(exportData, family.slug);
    
    // Convert Buffer to Uint8Array for NextResponse compatibility
    const bufferArray = new Uint8Array(dataExport.buffer);
    
    // Create response with zip file
    return new NextResponse(bufferArray, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${dataExport.filename}"`,
        'Content-Length': bufferArray.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error creating data export:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to create data export' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet as any);
