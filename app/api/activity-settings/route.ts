import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, ActivitySettings } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';

/**
 * GET /api/activity-settings
 * 
 * Retrieves activity settings for the current user
 * If caretakerId is provided, retrieves settings for that caretaker
 * Otherwise, retrieves global settings
 * 
 * Automatically adds any new activities from the default list to a caretaker's settings
 * if they don't already exist in their configuration
 */
async function getActivitySettings(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<ActivitySettings | null>>> {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    // Get caretakerId from query params if provided
    const url = new URL(req.url);
    const caretakerId = url.searchParams.get('caretakerId');
    
    console.log(`GET /api/activity-settings - caretakerId: ${caretakerId || 'null'}, familyId: ${userFamilyId}`);
    
    // Default settings to use if none are found
    const defaultSettings: ActivitySettings = {
      order: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'play', 'measurement', 'milestone', 'medicine', 'vaccine'],
      visible: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'play', 'measurement', 'milestone', 'medicine', 'vaccine'],
      caretakerId: caretakerId || null,
    };
    
    // Get settings from database
    const settings = await prisma.settings.findFirst({
      where: { 
        familyId: userFamilyId
      },
      orderBy: { updatedAt: 'desc' },
    });

    // If no settings record exists, return default settings
    if (!settings) {
      console.log('No settings record found, returning default settings');
      return NextResponse.json({ success: true, data: defaultSettings });
    }

    // Use type assertion to access activitySettings
    const settingsWithActivity = settings as unknown as (typeof settings & { activitySettings?: string });
    
    // If activitySettings field is empty, return default settings
    if (!settingsWithActivity.activitySettings) {
      console.log('No activitySettings found, returning default settings');
      return NextResponse.json({ success: true, data: defaultSettings });
    }

    // Parse stored settings
    let allSettings: Record<string, { order: string[], visible: string[] }>;
    try {
      allSettings = JSON.parse(settingsWithActivity.activitySettings);
    } catch (parseError) {
      console.error('Error parsing activitySettings JSON:', parseError);
      return NextResponse.json({ success: true, data: defaultSettings });
    }
    
    // If caretakerId is provided, try to get caretaker-specific settings
    if (caretakerId) {
      // If caretaker-specific settings exist, check for missing activities
      if (allSettings[caretakerId]) {
        console.log(`Found settings for caretakerId: ${caretakerId}`);
        
        // Check for missing activities in the caretaker's settings
        const caretakerSettings = allSettings[caretakerId];
        const defaultActivities = defaultSettings.order;
        const missingActivities = defaultActivities.filter(
          activity => !caretakerSettings.order.includes(activity)
        );
        
        // If there are missing activities, update the caretaker's settings
        if (missingActivities.length > 0) {
          console.log(`Found ${missingActivities.length} missing activities for caretakerId: ${caretakerId}`, missingActivities);
          
          // Add missing activities to order and visible arrays
          const updatedOrder = [...caretakerSettings.order, ...missingActivities];
          
          // Add missing activities to visible array if they're visible in default settings
          const updatedVisible = [...caretakerSettings.visible];
          for (const activity of missingActivities) {
            if (defaultSettings.visible.includes(activity) && !updatedVisible.includes(activity)) {
              updatedVisible.push(activity);
            }
          }
          
          // Update settings in the database
          allSettings[caretakerId] = {
            order: updatedOrder,
            visible: updatedVisible
          };
          
          // Save updated settings
          await prisma.settings.update({
            where: { id: settings.id },
            data: {
              // Use type assertion to allow activitySettings property
              ...(({ activitySettings: JSON.stringify(allSettings) }) as any)
            }
          });
          
          console.log(`Updated settings for caretakerId: ${caretakerId} with missing activities`);
          
          // Return updated settings
          return NextResponse.json({ 
            success: true, 
            data: {
              order: updatedOrder,
              visible: updatedVisible,
              caretakerId
            }
          });
        }
        
        // If no missing activities, return existing settings
        return NextResponse.json({ 
          success: true, 
          data: {
            ...allSettings[caretakerId],
            caretakerId
          }
        });
      }
      
      // If no caretaker-specific settings exist but global settings do, use global settings as a base
      // and check for missing activities compared to defaults
      if (allSettings.global) {
        console.log(`No settings for caretakerId: ${caretakerId}, using global settings`);
        
        // Get global settings
        const globalSettings = allSettings.global;
        
        // Check for missing activities in global settings
        const defaultActivities = defaultSettings.order;
        const missingActivities = defaultActivities.filter(
          activity => !globalSettings.order.includes(activity)
        );
        
        // Create caretaker settings based on global settings
        const caretakerOrder = [...globalSettings.order];
        const caretakerVisible = [...globalSettings.visible];
        
        // Add any missing activities
        let settingsUpdated = false;
        if (missingActivities.length > 0) {
          console.log(`Found ${missingActivities.length} missing activities in global settings`, missingActivities);
          
          // Add missing activities to order and visible arrays
          for (const activity of missingActivities) {
            caretakerOrder.push(activity);
            
            // Add to visible if it's visible in default settings
            if (defaultSettings.visible.includes(activity) && !caretakerVisible.includes(activity)) {
              caretakerVisible.push(activity);
            }
          }
          
          settingsUpdated = true;
        }
        
        // Create new caretaker settings
        allSettings[caretakerId] = {
          order: caretakerOrder,
          visible: caretakerVisible
        };
        
        // Save updated settings if needed
        if (settingsUpdated) {
          await prisma.settings.update({
            where: { id: settings.id },
            data: {
              // Use type assertion to allow activitySettings property
              ...(({ activitySettings: JSON.stringify(allSettings) }) as any)
            }
          });
          
          console.log(`Created settings for caretakerId: ${caretakerId} based on global settings with missing activities added`);
        } else {
          console.log(`Created settings for caretakerId: ${caretakerId} based on global settings (no missing activities)`);
        }
        
        // Return the new caretaker settings
        return NextResponse.json({ 
          success: true, 
          data: {
            order: caretakerOrder,
            visible: caretakerVisible,
            caretakerId
          }
        });
      }
      
      console.log(`No settings for caretakerId: ${caretakerId} and no global settings, using defaults`);
    }
    
    // Return global settings or default if no settings exist
    // If returning global settings, check for missing activities
    if (allSettings.global) {
      const globalSettings = allSettings.global;
      
      // Check for missing activities in global settings
      const defaultActivities = defaultSettings.order;
      const missingActivities = defaultActivities.filter(
        activity => !globalSettings.order.includes(activity)
      );
      
      // If there are missing activities, update the global settings
      if (missingActivities.length > 0) {
        console.log(`Found ${missingActivities.length} missing activities in global settings`, missingActivities);
        
        // Add missing activities to order and visible arrays
        const updatedOrder = [...globalSettings.order, ...missingActivities];
        
        // Add missing activities to visible array if they're visible in default settings
        const updatedVisible = [...globalSettings.visible];
        for (const activity of missingActivities) {
          if (defaultSettings.visible.includes(activity) && !updatedVisible.includes(activity)) {
            updatedVisible.push(activity);
          }
        }
        
        // Update settings in the database
        allSettings.global = {
          order: updatedOrder,
          visible: updatedVisible
        };
        
        // Save updated settings
        await prisma.settings.update({
          where: { id: settings.id },
          data: {
            // Use type assertion to allow activitySettings property
            ...(({ activitySettings: JSON.stringify(allSettings) }) as any)
          }
        });
        
        console.log(`Updated global settings with missing activities`);
        
        // Return updated settings
        return NextResponse.json({ 
          success: true, 
          data: {
            order: updatedOrder,
            visible: updatedVisible,
            caretakerId: null
          }
        });
      }
    }
    
    // Return global settings or default if no updates needed
    return NextResponse.json({ 
      success: true, 
      data: {
        ...(allSettings.global || defaultSettings),
        caretakerId: null
      }
    });
  } catch (error) {
    console.error('Error retrieving activity settings:', error);
    // Return default settings even in case of error
    const url = new URL(req.url);
    const errorCaretakerId = url.searchParams.get('caretakerId');
    
    return NextResponse.json({ 
      success: true, 
      data: {
        order: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'play', 'measurement', 'milestone', 'medicine', 'vaccine'],
        visible: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'play', 'measurement', 'milestone', 'medicine', 'vaccine'],
        caretakerId: errorCaretakerId || null,
      }
    });
  }
}

/**
 * POST /api/activity-settings
 * 
 * Saves activity settings for the current user
 * If caretakerId is provided in the body, saves settings for that caretaker
 * Otherwise, saves global settings
 * 
 * Also ensures any new activities from the default list are included in the saved settings
 */
async function saveActivitySettings(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<ActivitySettings | null>>> {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const { order, visible, caretakerId } = body as ActivitySettings;
    
    console.log(`POST /api/activity-settings - caretakerId: ${caretakerId || 'null'}, familyId: ${userFamilyId}`);

    // Validate input
    if (!order || !Array.isArray(order) || !visible || !Array.isArray(visible)) {
      console.error('Invalid activity settings format:', { order, visible });
      return NextResponse.json(
        { success: false, error: 'Invalid activity settings format' },
        { status: 400 }
      );
    }
    
    // Default activities list - keep in sync with the one in getActivitySettings
    const defaultActivities = [
      'sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'play', 'measurement', 'milestone', 'medicine', 'vaccine'
    ];
    
    // Check for any missing activities in the provided order
    const missingActivities = defaultActivities.filter(
      activity => !order.includes(activity)
    );
    
    // If there are missing activities, add them to the order and visible arrays
    let updatedOrder = [...order];
    let updatedVisible = [...visible];
    
    if (missingActivities.length > 0) {
      console.log(`Found ${missingActivities.length} missing activities in submitted settings`, missingActivities);
      
      // Add missing activities to order array
      updatedOrder = [...order, ...missingActivities];
      
      // Add missing activities to visible array if they should be visible by default
      for (const activity of missingActivities) {
        if (defaultActivities.includes(activity) && !updatedVisible.includes(activity)) {
          updatedVisible.push(activity);
        }
      }
      
      console.log('Updated order and visible arrays with missing activities');
    }

    // Get current settings
    let currentSettings = await prisma.settings.findFirst({
      where: { 
        familyId: userFamilyId
      },
      orderBy: { updatedAt: 'desc' },
    });

    // If no settings record exists, create one
    if (!currentSettings) {
      console.log('No settings record found, creating a new one');
      currentSettings = await prisma.settings.create({
        data: {
          familyId: userFamilyId,
          familyName: 'My Family',
          securityPin: '111222',
          defaultBottleUnit: 'OZ',
          defaultSolidsUnit: 'TBSP',
          defaultHeightUnit: 'IN',
          defaultWeightUnit: 'LB',
          defaultTempUnit: 'F',
          activitySettings: JSON.stringify({
            global: {
              order: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'play', 'measurement', 'milestone', 'medicine', 'vaccine'],
              visible: ['sleep', 'feed', 'diaper', 'note', 'bath', 'pump', 'play', 'measurement', 'milestone', 'medicine', 'vaccine']
            }
          }),
        }
      });
    }

    // Use type assertion to access activitySettings
    const currentSettingsWithActivity = currentSettings as unknown as (typeof currentSettings & { activitySettings?: string });
    
    // Parse existing activity settings or create new object
    let allSettings: Record<string, { order: string[], visible: string[] }> = {};
    if (currentSettingsWithActivity?.activitySettings) {
      try {
        allSettings = JSON.parse(currentSettingsWithActivity.activitySettings);
      } catch (e) {
        console.error('Error parsing existing activity settings:', e);
        // If parsing fails, start with a fresh object
        allSettings = {};
      }
    }

    // Update settings for the specific caretaker or global settings
    const settingsKey = caretakerId || 'global';
    
    // Create a new settings object that preserves all existing settings
    const newSettings = {
      ...allSettings,
      [settingsKey]: {
        order: updatedOrder,
        visible: updatedVisible
      }
    };
    
    // Ensure we're not accidentally removing other caretakers' settings
    allSettings = newSettings;

    console.log(`Saving settings for ${settingsKey}:`, newSettings[settingsKey]);

    // Save to database using type assertion for the data object
    const updatedSettings = await prisma.settings.update({
      where: { id: currentSettings.id },
      data: {
        // Use type assertion to allow activitySettings property
        ...(({ activitySettings: JSON.stringify(allSettings) }) as any)
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        order: updatedOrder,
        visible: updatedVisible,
        caretakerId: caretakerId || null
      }
    });
  } catch (error) {
    console.error('Error saving activity settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save activity settings' },
      { status: 500 }
    );
  }
}

// Export handlers with authentication
export const GET = withAuthContext(getActivitySettings);
export const POST = withAuthContext(saveActivitySettings);
