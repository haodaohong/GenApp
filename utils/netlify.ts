import { createScopedLogger } from './logger';

const logger = createScopedLogger('utils.netlify');

/**
 * Creates a new site on Netlify
 * @param siteName The name for the new Netlify site
 * @param token Netlify API token
 * @returns The response data from Netlify API
 */
export async function createNetlifySite(siteName: string, token: string = process.env.NEXT_PUBLIC_NETLIFY_TOKEN || '') {
  try {
    const response = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: siteName
      }),
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Netlify API error: ${response.status} - ${errorText}`);
      return { error: 'Failed to create Netlify site' };
    //   throw new Error(`Netlify API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Error creating Netlify site:', error);
    throw error;
  }
}


async function getSiteDetailsByName(appName: string, accessToken: string) {
    const url = 'https://api.netlify.com/api/v1/sites';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  
    const sites = await response.json();
    const targetSite = sites.find((site: any) => site.name === appName);
  
    if (targetSite) {
      console.log('应用详情:', targetSite);
      return targetSite;
    }
    console.log(`未找到名为 ${appName} 的应用`);
    return null;
}


export async function deployToNetlify(githubToken: string, netlifyToken: string, repo: string, siteId: string, appId: string) {
     // Trigger GitHub Actions workflow
     const githubResponse = await fetch(
        "https://api.github.com/repos/wordixai/clone-action/actions/workflows/deploy-to-netlify.yml/dispatches",
        {
            method: 'POST',
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: 'main',
                inputs: {
                    repository_url: repo,
                    netlify_auth_token: netlifyToken,
                    netlify_site_id: siteId,
                    github_token: githubToken,
                    app_id: appId
                }
            })
        }
    );
    
    if (!githubResponse.ok) {
        const errorText = await githubResponse.text();
        return { error: `GitHub API error: ${githubResponse.status} - ${errorText}`};
    }

    // Check if response is empty
    const responseText = await githubResponse.text();


    if (!responseText) {
        console.log('Empty response from GitHub API - workflow dispatch successful');
        return { success: true };
    }

    try {
        const data = JSON.parse(responseText);

        console.log('GitHub API response:', data);
        return data;
    } catch (error) {
        console.error('Error parsing GitHub API response:', error);
        return { error: 'Failed to parse GitHub API response' };
    }
}