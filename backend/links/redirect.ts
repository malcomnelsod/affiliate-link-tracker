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
}

export interface RedirectResponse {
  redirectUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
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

function generateFingerprint(userAgent: string, acceptLanguage: string): string {
  const data = `${userAgent}${acceptLanguage}${Date.now()}`;
  return Buffer.from(data).toString('base64').substring(0, 16);
}

function detectBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
    /whatsapp/i, /telegram/i, /skype/i,
    /curl/i, /wget/i, /python/i, /java/i, /php/i
  ];
  
  return botPatterns.some(pattern => pattern.test(userAgent));
}

function generateCloakingHtml(redirectUrl: string, config: any): string {
  const delay = config.delayRedirect ? Math.floor(Math.random() * 3000) + 1000 : 0;
  
  if (config.javascriptRedirect) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <meta name="robots" content="noindex, nofollow">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .message { color: #666; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Redirecting...</h2>
        <div class="loader"></div>
        <p class="message">Please wait while we redirect you to your destination.</p>
    </div>
    <script>
        // Anti-bot detection
        if (navigator.webdriver || window.phantom || window._phantom || window.callPhantom) {
            document.body.innerHTML = '<div class="container"><h2>Access Denied</h2><p>This link is not accessible via automated tools.</p></div>';
        } else {
            // Obfuscated redirect with multiple layers
            var encodedUrl = '${Buffer.from(redirectUrl).toString('base64')}';
            var url = atob(encodedUrl);
            
            // Add random delay to avoid pattern detection
            var redirectDelay = ${delay};
            
            setTimeout(function() {
                // Use multiple redirect methods for better compatibility
                try {
                    window.location.replace(url);
                } catch(e) {
                    try {
                        window.location.href = url;
                    } catch(e2) {
                        document.location = url;
                    }
                }
            }, redirectDelay);
            
            // Fallback redirect after longer delay
            setTimeout(function() {
                if (window.location.href.indexOf(url) === -1) {
                    document.location = url;
                }
            }, redirectDelay + 5000);
        }
    </script>
</body>
</html>`;
  } else {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="${Math.floor(delay / 1000)};url=${redirectUrl}">
    <meta name="robots" content="noindex, nofollow">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 400px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .link { color: #3498db; text-decoration: none; }
        .link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Redirecting...</h2>
        <p>If you are not redirected automatically, <a href="${redirectUrl}" class="link">click here</a>.</p>
    </div>
</body>
</html>`;
  }
}

// Handles link redirection with cloaking and anti-detection mechanisms.
export const redirect = api<RedirectRequest, RedirectResponse>(
  { expose: true, method: "GET", path: "/r/:linkId" },
  async (req) => {
    const { linkId, userAgent = '', referer = '', acceptLanguage = '' } = req;

    try {
      const links = await loadLinks();
      const link = links.find(l => l.id === linkId);

      if (!link) {
        throw APIError.notFound("Link not found");
      }

      if (link.status !== 'active') {
        throw APIError.permissionDenied("Link is not active");
      }

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
      const fingerprint = generateFingerprint(userAgent, acceptLanguage);
      
      const newClick: ClickData = {
        id: clickId,
        linkId,
        timestamp: new Date().toISOString(),
        userAgent,
        ipAddress: '', // Will be filled by the gateway
        geoLocation: '', // Will be filled by geo-location service
        referer,
        fingerprint
      };

      clicks.push(newClick);
      await saveClicks(clicks);

      // Get the final destination URL
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

      const redirectUrl = finalUrl.toString();

      // Apply cloaking if enabled
      if (link.enableCloaking === 'true') {
        // Bot detection
        if (detectBot(userAgent)) {
          // Serve innocent content to bots
          return {
            redirectUrl: 'https://www.google.com',
            statusCode: 302,
            headers: {
              'Location': 'https://www.google.com',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          };
        }

        // Generate cloaking HTML for human visitors
        const cloakingHtml = generateCloakingHtml(redirectUrl, cloakingConfig);

        return {
          redirectUrl,
          statusCode: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Robots-Tag': 'noindex, nofollow'
          },
          body: cloakingHtml
        };
      }

      // Direct redirect for non-cloaked links
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
      throw APIError.internal("Redirect failed");
    }
  }
);
