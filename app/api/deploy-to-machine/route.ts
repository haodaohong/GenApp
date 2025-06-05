// app/api/update-files/route.ts
import { NextResponse } from 'next/server';
import { updateFileList, gitPullOriginMain } from '@/utils/machines';
import { auth } from 'auth';
import { pushFiles } from '@/utils/git/push-files';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body: { appName: string; files: { path: string; content: string }[]; installDependencies: string } = await request.json();
    const { appName, files, installDependencies } = body;

    const session = await auth();
    if (!session) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // 创建一个新的 ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        async function noticeHost(data: any) {
          const message = `data: ${JSON.stringify({
            event: 'message',
            data: data,
          })}\n\n`;
          controller.enqueue(encoder.encode(message));
        }

        // 发送开始消息
        await noticeHost({
          event: 'start',
          message: 'Updating file list...',
        });

        try {
          // await updateFileList(
          //   appName,
          //   files,
          //   installDependencies,
          //   async (result: any) => {
          //     await noticeHost(result);
          //   }
          // );

          // const result = await pushFiles({
          //   token: process.env.NEXT_PUBLIC_GITHUB_TOKEN || '',
          //   owner: 'wordixai',
          //   repo: `genfly-${appName}`,
          //   files,
          //   message: 'Update files',
          // });

          // await noticeHost({
          //   event: 'pushtorepo',
          //   data: {
          //     message: 'Pushing files to GitHub',
          //     ...result,
          //   },
          // });

          // await gitPullOriginMain(appName);

          // 发送完成消息
          await noticeHost({
            event: 'complete',
            result: 'Update completed',
          });
        } catch (error) {
          await noticeHost({
            event: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}