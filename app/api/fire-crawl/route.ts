import { type NextRequest, NextResponse } from 'next/server';
import FirecrawlApp, { type ScrapeResponse } from '@mendable/firecrawl-js';


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, options } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const app = new FirecrawlApp({apiKey: "fc-590ebeb5e3ea44b4a1320bd8a89ce46a"});

    // Scrape a website:
    const scrapeResult = await app.scrapeUrl('https://lovable.dev', { 
        formats: ["screenshot@fullPage"],
        waitFor: 3000,
     }) as ScrapeResponse;
    
    if (!scrapeResult.success) {
      throw new Error(`Failed to scrape: ${scrapeResult.error}`)
    }
    
    console.log(scrapeResult)

    return NextResponse.json(scrapeResult, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  } catch (error) {
    console.error('FireCrawl error:', error);
    return NextResponse.json(
      { error: 'An error occurred during crawling' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
