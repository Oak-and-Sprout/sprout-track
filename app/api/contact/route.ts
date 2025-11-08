import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';

// Type for contact response
interface ContactResponse {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Type for contact create/update
interface ContactCreate {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const role = searchParams.get('role');

    // Build where clause
    const where: any = {
      deletedAt: null,
      familyId: familyId, // Filter by family ID from auth context
    };

    // Add filters
    if (id) {
      where.id = id;
    }

    if (role) {
      where.role = role;
    }

    // If ID is provided, fetch a single contact
    if (id) {
      const contact = await prisma.contact.findFirst({
        where: {
          id,
          deletedAt: null,
          familyId: familyId, // Filter by family ID from auth context
        },
      });

      if (!contact) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Contact not found',
          },
          { status: 404 }
        );
      }

      // Format dates for response
      const response: Omit<ContactResponse, 'familyId'> = {
        ...contact,
        createdAt: formatForResponse(contact.createdAt) || '',
        updatedAt: formatForResponse(contact.updatedAt) || '',
        deletedAt: formatForResponse(contact.deletedAt),
      };

      return NextResponse.json<ApiResponse<Omit<ContactResponse, 'familyId'>>>({
        success: true,
        data: response,
      });
    }

    // Fetch multiple contacts
    const contacts = await prisma.contact.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    // Format dates for response
    const response: Omit<ContactResponse, 'familyId'>[] = contacts.map(contact => ({
      ...contact,
      createdAt: formatForResponse(contact.createdAt) || '',
      updatedAt: formatForResponse(contact.updatedAt) || '',
      deletedAt: formatForResponse(contact.deletedAt),
    }));

    return NextResponse.json<ApiResponse<Omit<ContactResponse, 'familyId'>[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch contacts',
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
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }
    const body: ContactCreate = await req.json();

    // Validate required fields
    if (!body.name || !body.role) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Name and role are required',
        },
        { status: 400 }
      );
    }

    // Create contact
    const contact = await prisma.contact.create({
      data: {
        name: body.name,
        role: body.role,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
        familyId: familyId, // Set family ID from auth context
      },
    });

    // Format dates for response
    const response: Omit<ContactResponse, 'familyId'> = {
      ...contact,
      createdAt: formatForResponse(contact.createdAt) || '',
      updatedAt: formatForResponse(contact.updatedAt) || '',
      deletedAt: formatForResponse(contact.deletedAt),
    };

    return NextResponse.json<ApiResponse<Omit<ContactResponse, 'familyId'>>>({
      success: true,
      data: response,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to create contact',
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
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body: ContactCreate = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Contact ID is required',
        },
        { status: 400 }
      );
    }

    // Check if contact exists and belongs to the family
    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        familyId: familyId,
      },
    });

    if (!existingContact || existingContact.deletedAt) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Contact not found',
        },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!body.name || !body.role) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Name and role are required',
        },
        { status: 400 }
      );
    }

    // Update contact
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        notes: body.notes || null,
      },
    });

    // Format dates for response
    const response: Omit<ContactResponse, 'familyId'> = {
      ...contact,
      createdAt: formatForResponse(contact.createdAt) || '',
      updatedAt: formatForResponse(contact.updatedAt) || '',
      deletedAt: formatForResponse(contact.deletedAt),
    };

    return NextResponse.json<ApiResponse<Omit<ContactResponse, 'familyId'>>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to update contact',
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
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Contact ID is required',
        },
        { status: 400 }
      );
    }

    // Check if contact exists and belongs to the family
    const existingContact = await prisma.contact.findFirst({
      where: {
        id,
        familyId: familyId,
      },
    });

    if (!existingContact || existingContact.deletedAt) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Contact not found',
        },
        { status: 404 }
      );
    }

    // Soft delete contact
    await prisma.contact.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to delete contact',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost);
export const PUT = withAuthContext(handlePut);
export const DELETE = withAuthContext(handleDelete as any);
