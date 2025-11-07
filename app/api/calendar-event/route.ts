import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { CalendarEventType, RecurrencePattern } from '@prisma/client';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';

// Type for calendar event response
interface CalendarEventResponse {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  allDay: boolean;
  type: CalendarEventType;
  location: string | null;
  color: string | null;
  recurring: boolean;
  recurrencePattern: RecurrencePattern | null;
  recurrenceEnd: string | null;
  customRecurrence: string | null;
  reminderTime: number | null;
  notificationSent: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  familyId: string | null;
  babies: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  caretakers: Array<{
    id: string;
    name: string;
    type: string | null;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
  }>;
  contactIds: string[];
}

// Type for calendar event create/update
interface CalendarEventCreate {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  allDay: boolean;
  type: CalendarEventType;
  location?: string;
  color?: string;
  recurring: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceEnd?: string;
  customRecurrence?: string;
  reminderTime?: number;
  babyIds: string[];
  caretakerIds: string[];
  contactIds: string[];
  familyId?: string;
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const babyId = searchParams.get('babyId');
    const caretakerId = searchParams.get('caretakerId');
    const contactId = searchParams.get('contactId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const typeParam = searchParams.get('type');
    const recurringParam = searchParams.get('recurring');

    // Build where clause
    const where: any = {
      deletedAt: null,
      familyId: userFamilyId,
    };

    // Add filters
    if (id) {
      where.id = id;
    }

    if (babyId) {
      // Verify that the baby belongs to the user's family before filtering
      const baby = await prisma.baby.findFirst({
        where: {
          id: babyId,
          familyId: userFamilyId,
        },
        select: {
          familyId: true,
        },
      });

      if (!baby) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: "Baby not found in this family." },
          { status: 404 }
        );
      }

      where.babies = {
        some: {
          babyId,
        },
      };
    }

    if (caretakerId) {
      where.caretakers = {
        some: {
          caretakerId,
        },
      };
    }

    if (contactId) {
      where.contacts = {
        some: {
          contactId,
        },
      };
    }

    if (startDate && endDate) {
      where.startTime = {
        gte: toUTC(startDate),
        lte: toUTC(endDate),
      };
    }

    if (typeParam && Object.values(CalendarEventType).includes(typeParam as CalendarEventType)) {
      where.type = typeParam;
    }

    if (recurringParam !== null && ['true', 'false'].includes(recurringParam as string)) {
      where.recurring = recurringParam === 'true';
    }

    // If ID is provided, fetch a single event
    if (id) {
      const event = await prisma.calendarEvent.findFirst({
        where: { id, familyId: userFamilyId },
        include: {
          babies: {
            include: {
              baby: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          caretakers: {
            include: {
              caretaker: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
          contacts: {
            include: {
              contact: true,
            },
          },
        },
      });

      if (!event || event.deletedAt) {
        return NextResponse.json<ApiResponse<CalendarEventResponse>>(
          {
            success: false,
            error: 'Calendar event not found or access denied',
          },
          { status: 404 }
        );
      }

      // Format dates and transform related entities
      const response: CalendarEventResponse = {
        ...event,
        startTime: formatForResponse(event.startTime) || '',
        endTime: formatForResponse(event.endTime),
        recurrenceEnd: formatForResponse(event.recurrenceEnd),
        createdAt: formatForResponse(event.createdAt) || '',
        updatedAt: formatForResponse(event.updatedAt) || '',
        deletedAt: formatForResponse(event.deletedAt),
        babies: event.babies.map(be => be.baby),
        caretakers: event.caretakers.map(ce => ce.caretaker),
        contacts: event.contacts.map(ce => ce.contact),
        contactIds: event.contacts.map(ce => ce.contact.id),
      };

      return NextResponse.json<ApiResponse<CalendarEventResponse>>({
        success: true,
        data: response,
      });
    }

    // Fetch multiple events
    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        babies: {
          include: {
            baby: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        caretakers: {
          include: {
            caretaker: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        contacts: {
          include: {
            contact: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Format dates and transform related entities
    const response: CalendarEventResponse[] = events.map(event => ({
      ...event,
      startTime: formatForResponse(event.startTime) || '',
      endTime: formatForResponse(event.endTime),
      recurrenceEnd: formatForResponse(event.recurrenceEnd),
      createdAt: formatForResponse(event.createdAt) || '',
      updatedAt: formatForResponse(event.updatedAt) || '',
      deletedAt: formatForResponse(event.deletedAt),
      babies: event.babies.map(be => be.baby),
      caretakers: event.caretakers.map(ce => ce.caretaker),
      contacts: event.contacts.map(ce => ce.contact),
      contactIds: event.contacts.map(ce => ce.contact.id),
    }));

    return NextResponse.json<ApiResponse<CalendarEventResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json<ApiResponse<CalendarEventResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch calendar events',
      },
      { status: 500 }
    );
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId, caretakerId: userCaretakerId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body: CalendarEventCreate = await req.json();
    
    // Validate required fields
    if (!body.title || !body.startTime || body.type === undefined || body.allDay === undefined) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate that all associated entities belong to the user's family
    if (body.babyIds.length > 0) {
      const babiesCount = await prisma.baby.count({
        where: {
          id: { in: body.babyIds },
          familyId: userFamilyId,
        },
      });
      if (babiesCount !== body.babyIds.length) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'One or more babies not found in this family.' }, { status: 404 });
      }
    }

    if (body.caretakerIds.length > 0) {
      const caretakersCount = await prisma.caretaker.count({
        where: {
          id: { in: body.caretakerIds },
          familyId: userFamilyId,
        },
      });
      if (caretakersCount !== body.caretakerIds.length) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'One or more caretakers not found in this family.' }, { status: 404 });
      }
    }

    if (body.contactIds.length > 0) {
      const contactsCount = await prisma.contact.count({
        where: {
          id: { in: body.contactIds },
          familyId: userFamilyId,
        },
      });
      if (contactsCount !== body.contactIds.length) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'One or more contacts not found in this family.' }, { status: 404 });
      }
    }

    // Convert dates to UTC for storage
    const startTimeUTC = toUTC(body.startTime);
    const endTimeUTC = body.endTime ? toUTC(body.endTime) : null;
    const recurrenceEndUTC = body.recurrenceEnd ? toUTC(body.recurrenceEnd) : null;
    
    // Create event
    const event = await prisma.calendarEvent.create({
      data: {
        title: body.title,
        description: body.description || null,
        startTime: startTimeUTC,
        endTime: endTimeUTC,
        allDay: body.allDay,
        type: body.type,
        location: body.location || null,
        color: body.color || null,
        recurring: body.recurring,
        recurrencePattern: body.recurrencePattern || null,
        recurrenceEnd: recurrenceEndUTC || null,
        customRecurrence: body.customRecurrence || null,
        reminderTime: body.reminderTime || null,
        notificationSent: false,
        familyId: userFamilyId || null,
        
        // Create relationships
        babies: {
          create: body.babyIds.map(babyId => ({ babyId })),
        },
        caretakers: {
          create: body.caretakerIds.map(caretakerId => ({ caretakerId })),
        },
        contacts: {
          create: body.contactIds.map(contactId => ({ contactId })),
        },
      },
      include: {
        babies: {
          include: {
            baby: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        caretakers: {
          include: {
            caretaker: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        contacts: {
          include: {
            contact: true,
          },
        },
      },
    });
    
    // Format dates and transform related entities
    const response: CalendarEventResponse = {
      ...event,
      startTime: formatForResponse(event.startTime) || '',
      endTime: formatForResponse(event.endTime),
      recurrenceEnd: formatForResponse(event.recurrenceEnd),
      createdAt: formatForResponse(event.createdAt) || '',
      updatedAt: formatForResponse(event.updatedAt) || '',
      deletedAt: formatForResponse(event.deletedAt),
      babies: event.babies.map(be => be.baby),
      caretakers: event.caretakers.map(ce => ce.caretaker),
      contacts: event.contacts.map(ce => ce.contact),
      contactIds: event.contacts.map(ce => ce.contact.id),
    };
    
    return NextResponse.json<ApiResponse<CalendarEventResponse>>({
      success: true,
      data: response,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to create calendar event',
      },
      { status: 500 }
    );
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body: Partial<CalendarEventCreate> = await req.json();
    
    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Calendar event ID is required' }, { status: 400 });
    }

    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id, familyId: userFamilyId },
    });
    
    if (!existingEvent || existingEvent.deletedAt) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Calendar event not found or access denied' }, { status: 404 });
    }

    // Validate associated entities
    if (body.babyIds && body.babyIds.length > 0) {
      const babiesCount = await prisma.baby.count({
        where: { id: { in: body.babyIds }, familyId: userFamilyId },
      });
      if (babiesCount !== body.babyIds.length) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'One or more babies not found in this family.' }, { status: 404 });
      }
    }

    if (body.caretakerIds && body.caretakerIds.length > 0) {
      const caretakersCount = await prisma.caretaker.count({
        where: { id: { in: body.caretakerIds }, familyId: userFamilyId },
      });
      if (caretakersCount !== body.caretakerIds.length) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'One or more caretakers not found in this family.' }, { status: 404 });
      }
    }

    if (body.contactIds && body.contactIds.length > 0) {
      const contactsCount = await prisma.contact.count({
        where: { id: { in: body.contactIds }, familyId: userFamilyId },
      });
      if (contactsCount !== body.contactIds.length) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'One or more contacts not found in this family.' }, { status: 404 });
      }
    }

    // Convert dates to UTC for storage
    const startTimeUTC = body.startTime ? toUTC(body.startTime) : undefined;
    const endTimeUTC = body.endTime ? toUTC(body.endTime) : undefined;
    const recurrenceEndUTC = body.recurrenceEnd ? toUTC(body.recurrenceEnd) : undefined;
    
    // Update event in a transaction to handle relationships
    const updatedEvent = await prisma.$transaction(async (tx) => {
      // Delete existing relationships
      await tx.babyEvent.deleteMany({ where: { eventId: id } });
      await tx.caretakerEvent.deleteMany({ where: { eventId: id } });
      await tx.contactEvent.deleteMany({ where: { eventId: id } });
      
      // Update event
      const updated = await tx.calendarEvent.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description || null,
          startTime: startTimeUTC,
          endTime: endTimeUTC || null,
          allDay: body.allDay,
          type: body.type,
          location: body.location || null,
          color: body.color || null,
          recurring: body.recurring,
          recurrencePattern: body.recurrencePattern || null,
          recurrenceEnd: recurrenceEndUTC || null,
          customRecurrence: body.customRecurrence || null,
          reminderTime: body.reminderTime || null,
          familyId: userFamilyId || existingEvent.familyId, // Preserve existing familyId if not provided
          
          // Create new relationships
          babies: body.babyIds ? {
            deleteMany: {},
            create: body.babyIds.map(babyId => ({ babyId })),
          } : undefined,
          caretakers: body.caretakerIds ? {
            deleteMany: {},
            create: body.caretakerIds.map(caretakerId => ({ caretakerId })),
          } : undefined,
          contacts: body.contactIds ? {
            deleteMany: {},
            create: body.contactIds.map(contactId => ({ contactId })),
          } : undefined,
        },
        include: {
          babies: {
            include: {
              baby: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          caretakers: {
            include: {
              caretaker: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
          contacts: {
            include: {
              contact: true,
            },
          },
        },
      });
      
      return updated;
    });
    
    // Format dates and transform related entities
    const response: CalendarEventResponse = {
      ...updatedEvent,
      startTime: formatForResponse(updatedEvent.startTime) || '',
      endTime: formatForResponse(updatedEvent.endTime),
      recurrenceEnd: formatForResponse(updatedEvent.recurrenceEnd),
      createdAt: formatForResponse(updatedEvent.createdAt) || '',
      updatedAt: formatForResponse(updatedEvent.updatedAt) || '',
      deletedAt: formatForResponse(updatedEvent.deletedAt),
      babies: updatedEvent.babies.map(be => be.baby),
      caretakers: updatedEvent.caretakers.map(ce => ce.caretaker),
      contacts: updatedEvent.contacts.map(ce => ce.contact),
      contactIds: updatedEvent.contacts.map(ce => ce.contact.id),
    };
    
    return NextResponse.json<ApiResponse<CalendarEventResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to update calendar event',
      },
      { status: 500 }
    );
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Calendar event ID is required' }, { status: 400 });
    }

    const existingEvent = await prisma.calendarEvent.findFirst({
      where: { id, familyId: userFamilyId },
    });
    
    if (!existingEvent) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Calendar event not found or access denied' }, { status: 404 });
    }
    
    // Soft delete the event
    await prisma.calendarEvent.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
    
    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to delete calendar event',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware to all handlers
// Use type assertions to handle the multiple return types
export const GET = withAuthContext(handleGet as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const POST = withAuthContext(handlePost as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const PUT = withAuthContext(handlePut as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const DELETE = withAuthContext(handleDelete as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
