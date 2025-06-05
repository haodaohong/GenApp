import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revertCommit } from '@/utils/git/revert';

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { appName, commitSha, branch = 'main' } = body;

    const result = await revertCommit({ 
        commitSha, 
        appName, 
        branch: branch, 
    });

    return NextResponse.json({ 
        success: true, 
        message: 'Revert workflow triggered successfully', 
        result
    });
  } catch (error) {
    console.error('Error in revert API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
