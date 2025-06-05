import { NextResponse } from 'next/server';
import { createScopedLogger } from '@/utils/logger';
import { gitPullOriginMain } from '@/utils/machines';

const logger = createScopedLogger('api.fly-revert-remote');

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { fly_app_name } = await request.json();
    
    if (!fly_app_name) {
      return NextResponse.json({ error: 'App ID is required' }, { status: 400 });
    }

    logger.debug(`Reverting remote changes for app: ${fly_app_name}`);
    
    const result = await gitPullOriginMain(fly_app_name, false);
    
    if (!result.success) {
      logger.error(`Failed to revert remote changes: ${result.error}`);
      return NextResponse.json({ 
        error: 'Failed to revert remote changes',
        details: result.error
      }, { status: 500 });
    }
    
    logger.debug('Successfully reverted remote changes');
    
    return NextResponse.json({ 
      success: true,
      message: 'Remote changes reverted successfully',
      result: result.result
    });
    
  } catch (error) {
    logger.error(`Error in fly-revert-remote: ${error}`);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
