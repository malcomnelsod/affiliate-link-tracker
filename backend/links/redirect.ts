import { api, APIError } from "encore.dev/api";
import { Header } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface RedirectRequest {
  linkId: string;
  userAgent?: Header<"User-Agent">;
  referer?: Header<"Referer">;
  acceptLanguage?: Header<"Accept-Language">;
  xForwardedFor?: Header<"X-Forwarded-For">;
}

export interface RedirectResponse {
  redirectUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  isHtml?: boolean;
}

interface LinkData {
  id: string;
  rawUrl: string;
  shortUrl: string;
  cloakedUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: string;
  createdAt: string;
  customAlias?: string;
  tags: string;
  status: string;
  notes: string;
  customDomain?: string;
  enableCloaking: string;
  cloakingConfig: string;
}

interface ClickData {
  id: string;
  linkId: string;
  timestamp: string;
  userAgent: string;
  ipAddress: string;
  geoLocation: string;
}

async function loadLinks(): Promise<LinkData[]> {
  try {
    const linksData = await dataBucket.download("links.csv");
    const csvContent = linksData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        rawUrl: fields[1] || '',
        shortUrl: fields[2] || '',
        cloakedUrl: fields[3] || '',
        campaignId: fields[4] || '',
        userId: fields[5] || '',
        trackingParams: fields[6] || '{}',
        createdAt: fields[7] || '',
        customAlias: fields[8] || undefined,
        tags: fields[9] || '[]',
        status: fields[10] || 'active',
        notes: fields[11] || '',
        customDomain: fields[12] || undefined,
        enableCloaking: fields[13] || 'false',
        cloakingConfig: fields[14] || '{}'
      };
    }).filter(link => link.id && link.rawUrl);
  } catch (error) {
    return [];
  }
}

async function loadClicks(): Promise<ClickData[]> {
  try {
    const clicksData = await dataBucket.download("clicks.csv");
    const csvContent = clicksData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        linkId: fields[1] || '',
        timestamp: fields[2] || '',
        userAgent: fields[3] || '',
        ipAddress: fields[4] || '',
        geoLocation: fields[5] || ''
      };
    }).filter(click => click.id && click.linkId);
  } catch (error) {
    return [];
  }
}

async function saveClicks(clicks: ClickData[]): Promise<void> {
  const headers = ['id', 'linkId', 'timestamp', 'userAgent', 'ipAddress', 'geoLocation'];
  const rows = clicks.map(click => [
    click.id,
    click.linkId,
    click.timestamp,
    click.userAgent,
    click.ipAddress,
    click.geoLocation
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("clicks.csv", Buffer.from(csvContent));
}

function detectBot(userAgent: string): boolean {
  if (!userAgent) return true;
  
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
    /whatsapp/i, /telegram/i, /skype/i,
    /curl/i, /wget/i, /python/i, /java/i, /php/i,
    /headless/i, /phantom/i, /selenium/i, /webdriver/i,
    /puppeteer/i, /playwright/i, /automation/i
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

function getClientIP(xForwardedFor?: string): string {
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  return 'unknown';
}

function buildFinalUrl(rawUrl: string, trackingParams: any, clickId: string): string {
  try {
    const url = new URL(rawUrl);
    
    // Add tracking parameters
    Object.entries(trackingParams).forEach(([key, value]) => {
      url.searchParams.set(key, value as string);
    });
    
    // Add click ID
    url.searchParams.set('click_id', clickId);
    
    return url.toString();
  } catch (error) {
    // If URL parsing fails, return the raw URL with basic tracking
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}click_id=${clickId}`;
  }
}

// Handles link redirection with advanced cloaking and anti-detection mechanisms.
export const redirect = api<RedirectRequest, RedirectResponse>(
  { expose: true, method: "GET", path: "/r/:linkId" },
  async (req) => {
    const { linkId, userAgent = '', referer = '', acceptLanguage = '', xForwardedFor } = req;

    console.log(`Redirect request for linkId: ${linkId}`);
    console.log(`User-Agent: ${userAgent}`);

    try {
      const links = await loadLinks();
      console.log(`Loaded ${links.length} links from storage`);
      
      const link = links.find(l => l.id === linkId);

      if (!link) {
        console.log(`Link not found: ${linkId}`);
        throw APIError.notFound("Link not found");
      }

      if (link.status !== 'active') {
        console.log(`Link inactive: ${linkId}, status: ${link.status}`);
        throw APIError.notFound("Link not available");
      }

      console.log(`Found active link: ${link.rawUrl}`);

      // Get client IP
      const clientIP = getClientIP(xForwardedFor);

      // Track the click
      const clicks = await loadClicks();
      const clickId = `click_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      const newClick: ClickData = {
        id: clickId,
        linkId,
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress: clientIP,
        geoLocation: ''
      };

      clicks.push(newClick);
      await saveClicks(clicks);

      console.log(`Click tracked: ${clickId}`);

      // Get the final destination URL
      let trackingParams = {};
      try {
        trackingParams = JSON.parse(link.trackingParams);
      } catch (error) {
        console.log('Failed to parse tracking params, using empty object');
        trackingParams = {};
      }

      // Build the final URL with tracking parameters
      const redirectUrl = buildFinalUrl(link.rawUrl, trackingParams, clickId);

      console.log(`Final redirect URL: ${redirectUrl}`);

      // Check if cloaking is enabled and if this is a bot
      if (link.enableCloaking === 'true') {
        const isBot = detectBot(userAgent);
        
        console.log(`Cloaking enabled, isBot: ${isBot}`);
        
        if (isBot) {
          // For bots, return a simple 404 to avoid detection
          console.log(`Bot detected, returning 404`);
          throw APIError.notFound("Page not found");
        }

        // For human visitors with cloaking enabled, use JavaScript redirect
        const cloakingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <meta name="robots" content="noindex, nofollow">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f8f9fa;
            color: #333;
            margin: 0;
        }
        .container { 
            max-width: 400px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 10px; 
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        .loader { 
            border: 4px solid #f3f3f3; 
            border-top: 4px solid #007bff; 
            border-radius: 50%; 
            width: 40px; 
            height: 40px; 
            animation: spin 1s linear infinite; 
            margin: 20px auto; 
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Redirecting...</h2>
        <div class="loader"></div>
        <p>Please wait while we redirect you to your destination.</p>
    </div>
    <script>
        // Multiple redirect methods for better compatibility
        function redirect() {
            var url = '${redirectUrl.replace(/'/g, "\\'")}';
            try {
                // Method 1: Replace current page
                window.location.replace(url);
            } catch(e) {
                try {
                    // Method 2: Set location href
                    window.location.href = url;
                } catch(e2) {
                    try {
                        // Method 3: Assign location
                        window.location.assign(url);
                    } catch(e3) {
                        // Method 4: Open in same window
                        window.open(url, '_self');
                    }
                }
            }
        }
        
        // Add random delay between 500-2000ms
        var delay = Math.floor(Math.random() * 1500) + 500;
        setTimeout(redirect, delay);
        
        // Fallback: redirect immediately if JavaScript fails
        setTimeout(function() {
            if (window.location.href.indexOf('${redirectUrl.replace(/'/g, "\\'")}') === -1) {
                redirect();
            }
        }, 5000);
    </script>
    <noscript>
        <meta http-equiv="refresh" content="0;url=${redirectUrl}">
        <p>If you are not redirected automatically, <a href="${redirectUrl}">click here</a>.</p>
    </noscript>
</body>
</html>`;

        console.log(`Serving cloaking HTML with JavaScript redirect`);
        return {
          redirectUrl,
          statusCode: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: cloakingHtml,
          isHtml: true
        };
      }

      // Direct HTTP redirect for non-cloaked links
      console.log(`Direct HTTP redirect to: ${redirectUrl}`);
      return {
        redirectUrl,
        statusCode: 302,
        headers: {
          'Location': redirectUrl,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      };

    } catch (error) {
      console.error("Redirect error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("Redirect failed");
    }
  }
);
