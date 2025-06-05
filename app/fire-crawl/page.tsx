'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export default function FireCrawlPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('markdown');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/fire-crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to crawl the website');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">FireCrawl Website Scraper</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Enter Website URL</CardTitle>
          <CardDescription>
            Enter the URL of the website you want to scrape
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    Crawling...
                  </>
                ) : (
                  'Crawl Website'
                )}
              </Button>
            </div>
            {error && <p className="text-red-500">{error}</p>}
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Crawl Results</CardTitle>
            <CardDescription>
              Content scraped from {url}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="markdown">Markdown</TabsTrigger>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="raw">Raw Data</TabsTrigger>
              </TabsList>
              
              <TabsContent value="markdown" className="mt-2">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-[600px]">
                  <pre className="whitespace-pre-wrap">{result.formats?.markdown || 'No markdown content available'}</pre>
                </div>
              </TabsContent>
              
              <TabsContent value="html" className="mt-2">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-[600px]">
                  <pre className="whitespace-pre-wrap">{result.formats?.html || 'No HTML content available'}</pre>
                </div>
              </TabsContent>
              
              <TabsContent value="raw" className="mt-2">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-[600px]">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
