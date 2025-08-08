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
  referer: string;
  fingerprint: string;
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
        geoLocation: fields[5] || '',
        referer: fields[6] || '',
        fingerprint: fields[7] || ''
      };
    }).filter(click => click.id && click.linkId);
  } catch (error) {
    return [];
  }
}

async function saveClicks(clicks: ClickData[]): Promise<void> {
  const headers = ['id', 'linkId', 'timestamp', 'userAgent', 'ipAddress', 'geoLocation', 'referer', 'fingerprint'];
  const rows = clicks.map(click => [
    click.id,
    click.linkId,
    click.timestamp,
    click.userAgent,
    click.ipAddress,
    click.geoLocation,
    click.referer,
    click.fingerprint
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("clicks.csv", Buffer.from(csvContent));
}

function generateFingerprint(userAgent: string, acceptLanguage: string, ip: string): string {
  const data = `${userAgent}${acceptLanguage}${ip}${Date.now()}`;
  return Buffer.from(data).toString('base64').substring(0, 16);
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
    // X-Forwarded-For can contain multiple IPs, get the first one
    return xForwardedFor.split(',')[0].trim();
  }
  return 'unknown';
}

function generateCloakingHtml(redirectUrl: string, config: any, userAgent: string): string {
  const delay = config.delayRedirect ? Math.floor(Math.random() * 2000) + 500 : 100;
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  
  // Generate random attributes for obfuscation
  const randomId = Math.random().toString(36).substring(7);
  const randomClass = Math.random().toString(36).substring(7);
  
  if (config.javascriptRedirect) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            text-align: center; 
            padding: 50px 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .${randomClass} { 
            max-width: 400px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1); 
            padding: 40px; 
            border-radius: 20px; 
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .loader { 
            border: 4px solid rgba(255,255,255,0.3); 
            border-top: 4px solid #fff; 
            border-radius: 50%; 
            width: 50px; 
            height: 50px; 
            animation: spin 1s linear infinite; 
            margin: 20px auto; 
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }
        .message { 
            margin-top: 20px; 
            font-size: 16px;
            opacity: 0.9;
        }
        .progress {
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.3);
            border-radius: 2px;
            margin: 20px 0;
            overflow: hidden;
        }
        .progress-bar {
            height: 100%;
            background: #fff;
            width: 0%;
            animation: progress ${delay}ms linear forwards;
        }
        @keyframes progress {
            to { width: 100%; }
        }
        @media (max-width: 480px) {
            .${randomClass} { padding: 30px 20px; }
            body { padding: 20px 10px; }
        }
    </style>
</head>
<body>
    <div class="${randomClass}" id="${randomId}">
        <h2>Redirecting...</h2>
        <div class="loader"></div>
        <div class="progress">
            <div class="progress-bar"></div>
        </div>
        <p class="message">Please wait while we redirect you to your destination.</p>
    </div>
    <script>
        (function() {
            // Anti-automation detection
            var isBot = false;
            
            // Check for common automation indicators
            if (navigator.webdriver || 
                window.phantom || 
                window._phantom || 
                window.callPhantom ||
                window.chrome && window.chrome.runtime && window.chrome.runtime.onConnect ||
                navigator.userAgent.match(/HeadlessChrome|PhantomJS|Selenium|WebDriver/i)) {
                isBot = true;
            }
            
            // Check for missing properties that real browsers have
            if (!window.chrome && !window.safari && !navigator.plugins.length) {
                isBot = true;
            }
            
            if (isBot) {
                document.getElementById('${randomId}').innerHTML = 
                    '<h2>Access Restricted</h2><p>This content is not available for automated access.</p>';
                return;
            }
            
            // Encode URL multiple times for obfuscation
            var encodedUrl = '${Buffer.from(redirectUrl).toString('base64')}';
            var url = atob(encodedUrl);
            
            // Validate URL format
            try {
                new URL(url);
            } catch(e) {
                document.getElementById('${randomId}').innerHTML = 
                    '<h2>Error</h2><p>Invalid destination URL.</p>';
                return;
            }
            
            // Add tracking parameters
            var separator = url.includes('?') ? '&' : '?';
            url += separator + 'ref=' + encodeURIComponent(document.referrer || 'direct');
            url += '&t=' + Date.now();
            
            // Multiple redirect methods with fallbacks
            setTimeout(function() {
                try {
                    // Method 1: location.replace (doesn't add to history)
                    window.location.replace(url);
                } catch(e1) {
                    try {
                        // Method 2: location.href
                        window.location.href = url;
                    } catch(e2) {
                        try {
                            // Method 3: document.location
                            document.location = url;
                        } catch(e3) {
                            // Method 4: window.open as fallback
                            window.open(url, '_self');
                        }
                    }
                }
            }, ${delay});
            
            // Backup redirect after longer delay
            setTimeout(function() {
                if (window.location.href.indexOf(url.split('?')[0]) === -1) {
                    window.open(url, '_self');
                }
            }, ${delay + 3000});
            
            // Handle page visibility change (user switches tabs)
            document.addEventListener('visibilitychange', function() {
                if (!document.hidden && window.location.href.indexOf(url.split('?')[0]) === -1) {
                    window.location.href = url;
                }
            });
        })();
    </script>
</body>
</html>`;
  } else {
    // Meta refresh fallback for non-JS environments
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="${Math.ceil(delay / 1000)};url=${redirectUrl}">
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            text-align: center; 
            padding: 50px 20px; 
            background: #f8f9fa;
            color: #333;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            max-width: 400px; 
            margin: 0 auto; 
            background: white; 
            padding: 40px; 
            border-radius: 10px; 
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        .link { 
            color: #007bff; 
            text-decoration: none; 
            font-weight: 500;
        }
        .link:hover { 
            text-decoration: underline; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Redirecting...</h2>
        <p>If you are not redirected automatically, <a href="${redirectUrl}" class="link">click here to continue</a>.</p>
    </div>
</body>
</html>`;
  }
}

// Handles link redirection with advanced cloaking and anti-detection mechanisms.
export const redirect = api<RedirectRequest, RedirectResponse>(
  { expose: true, method: "GET", path: "/r/:linkId" },
  async (req) => {
    const { linkId, userAgent = '', referer = '', acceptLanguage = '', xForwardedFor } = req;

    try {
      const links = await loadLinks();
      const link = links.find(l => l.id === linkId);

      if (!link) {
        throw APIError.notFound("Link not found or has been removed");
      }

      if (link.status !== 'active') {
        throw APIError.permissionDenied("This link is currently inactive");
      }

      // Get client IP
      const clientIP = getClientIP(xForwardedFor);

      // Parse cloaking configuration
      let cloakingConfig = {
        userAgentRotation: false,
        referrerSpoofing: false,
        delayRedirect: false,
        javascriptRedirect: false
      };

      try {
        cloakingConfig = JSON.parse(link.cloakingConfig);
      } catch (error) {
        console.warn("Failed to parse cloaking config:", error);
      }

      // Track the click
      const clicks = await loadClicks();
      const clickId = `click_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const fingerprint = generateFingerprint(userAgent, acceptLanguage, clientIP);
      
      const newClick: ClickData = {
        id: clickId,
        linkId,
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress: clientIP,
        geoLocation: '', // Could be enhanced with geo-IP service
        referer,
        fingerprint
      };

      clicks.push(newClick);
      await saveClicks(clicks);

      // Get the final destination URL with tracking parameters
      let trackingParams = {};
      try {
        trackingParams = JSON.parse(link.trackingParams);
      } catch (error) {
        trackingParams = {};
      }

      const finalUrl = new URL(link.rawUrl);
      Object.entries(trackingParams).forEach(([key, value]) => {
        finalUrl.searchParams.set(key, value as string);
      });

      // Add additional tracking
      finalUrl.searchParams.set('click_id', clickId);
      finalUrl.searchParams.set('timestamp', Date.now().toString());

      const redirectUrl = finalUrl.toString();

      // Apply cloaking if enabled
      if (link.enableCloaking === 'true') {
        // Enhanced bot detection
        const isBot = detectBot(userAgent);
        
        if (isBot) {
          // Serve innocent content to bots (like major platforms do)
          const innocentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found</title>
    <meta name="robots" content="noindex, nofollow">
</head>
<body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    <h1>404 - Page Not Found</h1>
    <p>The page you are looking for could not be found.</p>
    <a href="https://www.google.com">Go to Google</a>
</body>
</html>`;

          return {
            redirectUrl: 'https://www.google.com',
            statusCode: 404,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'X-Robots-Tag': 'noindex, nofollow'
            },
            body: innocentHtml,
            isHtml: true
          };
        }

        // Generate cloaking HTML for human visitors
        const cloakingHtml = generateCloakingHtml(redirectUrl, cloakingConfig, userAgent);

        return {
          redirectUrl,
          statusCode: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Robots-Tag': 'noindex, nofollow',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff'
          },
          body: cloakingHtml,
          isHtml: true
        };
      }

      // Direct redirect for non-cloaked links (like bit.ly, tinyurl)
      return {
        redirectUrl,
        statusCode: 302,
        headers: {
          'Location': redirectUrl,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Redirect error:", error);
      throw APIError.internal("Redirect service temporarily unavailable");
    }
  }
);
