import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/prisma/db';
import { ApiResponse, withAdminAuth, getAuthenticatedUser, AuthResult } from '@/app/api/utils/auth';
import { Family } from '@prisma/client';

interface SetupStartRequest {
  name: string;
  slug: string;
  token?: string;
  isNewFamily?: boolean; // Flag to indicate this is a new family creation vs initial setup
}

async function handler(req: NextRequest): Promise<NextResponse<ApiResponse<Family>>> {
  const { name, slug, token, isNewFamily = false } = (await req.json()) as SetupStartRequest;

  if (!name || !slug) {
    return NextResponse.json({ success: false, error: 'Family name and slug are required' }, { status: 400 });
  }

  // Get authentication context
  const authResult = await getAuthenticatedUser(req);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Check for setup token authentication
  let setupTokenData = null;
  if (token) {
    // For setup token auth, verify the token matches the one in the JWT
    if (authResult.isSetupAuth && authResult.setupToken === token) {
      // Valid setup token authentication
      setupTokenData = await prisma.familySetup.findUnique({
        where: { token },
      });
      
      if (!setupTokenData || setupTokenData.expiresAt < new Date() || setupTokenData.familyId) {
        return NextResponse.json({ success: false, error: 'Invalid or expired setup token' }, { status: 403 });
      }
    } else if (!authResult.isSysAdmin && authResult.caretakerRole !== 'ADMIN') {
      // Token provided but user doesn't have permission or wrong token in auth
      return NextResponse.json({ success: false, error: 'Invalid setup token authentication' }, { status: 403 });
    } else {
      // Admin/sysadmin using token for some reason - validate it exists
      setupTokenData = await prisma.familySetup.findUnique({
        where: { token },
      });
      
      if (!setupTokenData || setupTokenData.expiresAt < new Date() || setupTokenData.familyId) {
        return NextResponse.json({ success: false, error: 'Invalid or expired setup token' }, { status: 403 });
      }
    }
  }

  try {
    if (token && setupTokenData) {
      // SCENARIO 3: Token-based setup - create new family and mark token as used
      
      // Check if slug is unique
      const existingFamily = await prisma.family.findUnique({ where: { slug } });
      if (existingFamily) {
        return NextResponse.json({ success: false, error: 'That URL is already taken' }, { status: 409 });
      }

      const updatedFamily = await prisma.$transaction(async (tx) => {
        // Create new family
        const family = await tx.family.create({
          data: {
            name,
            slug,
            isActive: true,
          },
        });

        // Create settings for the family
        await tx.settings.create({
          data: {
            familyId: family.id,
            familyName: name,
          },
        });

        // Create system caretaker for the family
        await tx.caretaker.create({
          data: {
            loginId: '00',
            name: 'system',
            type: 'System Administrator',
            role: 'ADMIN',
            securityPin: '111222', // Default PIN
            familyId: family.id,
            inactive: false,
          },
        });

        // Mark the invitation token as used
        await tx.familySetup.update({
          where: { token },
          data: { familyId: family.id },
        });

        return family;
      });

      return NextResponse.json({ success: true, data: updatedFamily });
    } else if (authResult.isAccountAuth && authResult.accountId) {
      // SCENARIO 4: Account owner setting up their family
      
      // Check if slug is unique
      const existingFamily = await prisma.family.findUnique({ where: { slug } });
      if (existingFamily) {
        return NextResponse.json({ success: false, error: 'That URL is already taken' }, { status: 409 });
      }

      // Check if account already has a family
      const existingAccountFamily = await prisma.family.findFirst({
        where: { accountId: authResult.accountId }
      });
      if (existingAccountFamily) {
        return NextResponse.json({ success: false, error: 'Account already has a family' }, { status: 409 });
      }

      const family = await prisma.$transaction(async (tx) => {
        // Create new family linked to account
        const newFamily = await tx.family.create({
          data: {
            name,
            slug,
            isActive: true,
            accountId: authResult.accountId,
          },
        });

        // Create default settings for the family
        await tx.settings.create({
          data: {
            familyId: newFamily.id,
            familyName: name,
            securityPin: '111222', // Default PIN, user can change later
            defaultBottleUnit: 'OZ',
            defaultSolidsUnit: 'TBSP',
            defaultHeightUnit: 'IN',
            defaultWeightUnit: 'LB',
            defaultTempUnit: 'F',
            activitySettings: JSON.stringify({
              global: {
                order: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'measurement', 'milestone', 'medicine'],
                visible: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'measurement', 'milestone', 'medicine']
              }
            })
          },
        });

        // Create system caretaker for the family
        await tx.caretaker.create({
          data: {
            loginId: '00',
            name: 'system',
            type: 'System Administrator',
            role: 'ADMIN',
            securityPin: '111222', // Default PIN
            familyId: newFamily.id,
            inactive: false,
          },
        });

        // Update account to link to family and set trial if needed
        const accountUpdateData: any = { familyId: newFamily.id };

        // Check if we're in SAAS mode and user is not a beta participant
        const deploymentMode = process.env.DEPLOYMENT_MODE;
        const isSaasMode = deploymentMode === 'saas';

        if (isSaasMode) {
          // Get current account to check beta status
          const currentAccount = await tx.account.findUnique({
            where: { id: authResult.accountId },
            select: { betaparticipant: true, trialEnds: true, planType: true }
          });

          // If not a beta participant and no existing trial/plan, set 14-day trial
          if (currentAccount && !currentAccount.betaparticipant && !currentAccount.trialEnds && !currentAccount.planType) {
            // Set trial to end at 11:59 PM 14 days from today
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 14);
            trialEndDate.setHours(23, 59, 59, 999); // End at 11:59:59 PM

            accountUpdateData.trialEnds = trialEndDate;

            console.log(`Setting 14-day trial for account ${authResult.accountId}, ending ${trialEndDate.toISOString()}`);
          }
        }

        await tx.account.update({
          where: { id: authResult.accountId },
          data: accountUpdateData
        });

        return newFamily;
      });

      return NextResponse.json({ success: true, data: family });
    } else if (authResult.isSysAdmin || authResult.caretakerRole === 'ADMIN') {
      // System admin or admin caretaker scenarios
      
      // Check if slug is unique
      const existingFamily = await prisma.family.findUnique({ where: { slug } });
      if (existingFamily) {
        return NextResponse.json({ success: false, error: 'That URL is already taken' }, { status: 409 });
      }

      const updatedFamily = await prisma.$transaction(async (tx) => {
        let family;

        if (isNewFamily) {
          // SCENARIO 2: Sysadmin creating a new family (from FamilyForm)
          family = await tx.family.create({
            data: {
              name,
              slug,
              isActive: true,
            },
          });

          await tx.settings.create({
            data: {
              familyId: family.id,
              familyName: name,
            },
          });

          // Create system caretaker for the family
          await tx.caretaker.create({
            data: {
              loginId: '00',
              name: 'system',
              type: 'System Administrator',
              role: 'ADMIN',
              securityPin: '111222', // Default PIN
              familyId: family.id,
              inactive: false,
            },
          });
        } else {
          // SCENARIO 1: Brand new setup - update existing default family or create new one
          const families = await tx.family.findMany();
          
          if (families.length === 1 && families[0].slug === 'my-family') {
            // Update the existing default family
            family = await tx.family.update({
              where: { id: families[0].id },
              data: {
                name,
                slug,
                isActive: true,
              },
            });

            // Update the existing settings for this family
            await tx.settings.updateMany({
              where: { familyId: family.id },
              data: {
                familyName: name,
              },
            });
          } else {
            // Fallback: create new family if default doesn't exist
            family = await tx.family.create({
              data: {
                name,
                slug,
                isActive: true,
              },
            });

            await tx.settings.create({
              data: {
                familyId: family.id,
                familyName: name,
              },
            });

            // Create system caretaker for the family
            await tx.caretaker.create({
              data: {
                loginId: '00',
                name: 'system',
                type: 'System Administrator',
                role: 'ADMIN',
                securityPin: '111222', // Default PIN
                familyId: family.id,
                inactive: false,
              },
            });
          }
        }

        return family;
      });

      return NextResponse.json({ success: true, data: updatedFamily });
    }

    // This should not be reached due to authentication check above
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  } catch (error) {
    console.error('Error starting setup:', error);
    return NextResponse.json({ success: false, error: 'Error starting setup' }, { status: 500 });
  }
}

// Custom wrapper to allow both admin auth and account owners
async function authWrapper(req: NextRequest): Promise<NextResponse<ApiResponse<Family>>> {
  const authResult = await getAuthenticatedUser(req);
  
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  
  // Allow admin users, system administrators, setup tokens, or account owners
  if (authResult.isSysAdmin || 
      authResult.caretakerRole === 'ADMIN' || 
      authResult.isSetupAuth || 
      authResult.isAccountAuth) {
    return handler(req);
  }
  
  return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
}

export const POST = authWrapper; 