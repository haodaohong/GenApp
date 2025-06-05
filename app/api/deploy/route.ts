// app/api/deploy/route.ts
import { NextResponse } from 'next/server';
import { createScopedLogger } from '@/utils/logger';
import { deployApp } from '@/utils/machines';
import { auth } from 'auth';

const logger = createScopedLogger('api.deploy');

export async function POST(request: Request) {

  try {
    const data: { 
      appName: string,
      sourceRepoUrl: string,
      flyApiToken: string,
      dockerImage: string
    } = await request.json();

    const session = await auth();
    if (!session) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const { appName, sourceRepoUrl, dockerImage } = data;

    if (!appName || !sourceRepoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    logger.info('Deployment API called with data:', data);

    try {
      const response = await fetch(
        'https://api.github.com/repos/wordixai/clone-action/actions/workflows/clone.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              source_repo_url: sourceRepoUrl,
              new_repo_name: `genfly-${appName}`,
              github_token: process.env.NEXT_PUBLIC_GITHUB_TOKEN,
              fly_api_token: process.env.FLY_API_TOKEN,
              fly_app_name: appName,
              docker_image: dockerImage || "registry.fly.io/ancodeai-app:latest",
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }

      return NextResponse.json({
        status: 'success',
        message: 'Successfully triggered deployment workflow',
      });
    } catch (error) {
      logger.error('Error triggering deployment workflow:', error);
      return NextResponse.json(
        {
          status: 'error',
          message: 'Error triggering deployment workflow',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error in deployment API:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to process deployment request',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    message: 'Deployment API is available',
    timestamp: new Date().toISOString(),
  });
}

// Handle unsupported methods
export async function OPTIONS() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}