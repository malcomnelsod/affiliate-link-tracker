import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { secret } from "encore.dev/config";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });
const shortIoApiKey = secret("ShortIoApiKey");

export interface BulkCreateLinksRequest {
  urls: Array<{
    rawUrl: string;
    customAlias?: string;
    tags?: string[];
  }>;
  campaignId: string;
  userId: string;
  trackingParams?: Record<string, string>;
  enableCloaking?: boolean;
  customDomain?: string;
}

export interface BulkCreateLinksResponse {
  links: Array<{
    id: string;
    rawUrl: string;
    shortUrl: string;
    cloakedUrl: string;
    customAlias?: string;
    tags: string[];
  }>;
  successCount: number;
  failureCount: number;
  errors: string[];
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

async function saveLinks(links: LinkData[]): Promise<void> {
  const headers = ['id', 'rawUrl', 'shortUrl', 'cloakedUrl', 'campaignId', 'userId', 'trackingParams', 'createdAt', 'customAlias', 'tags', 'status', 'notes', 'customDomain', 'enableCloaking', 'cloakingConfig'];
  const rows = links.map(link => [
    link.id,
    link.rawUrl,
    link.shortUrl,
    link.cloakedUrl,
    link.campaignId,
    link.userId,
    link.trackingParams,
    link.createdAt,
    link.customAlias || '',
    link.tags,
    link.status,
    link.notes,
    link.customDomain || '',
    link.enableCloaking,
    link.cloakingConfig
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("links.csv", Buffer.from(csvContent));
}

function getAppDomain(): string {
  // Get the actual deployed app domain from environment
  const appUrl = process.env.ENCORE_APP_URL;
  if (appUrl) {
    // Remove any port numbers and ensure proper protocol
    const url = new URL(appUrl);
    return `${url.protocol}//${url.hostname}`;
  }
  
  // Fallback for development - use standard ports
  return 'http://localhost';
}

function generateCloakedUrl(linkId: string, customDomain?: string): string {
  let domain;
  
  if (customDomain) {
    // Custom domain should be just the domain name, add https protocol
    domain = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
  } else {
    domain = getAppDomain();
  }
  
  // Remove trailing slash and ensure no custom ports
  const url = new URL(domain);
  domain = `${url.protocol}//${url.hostname}`;
  
  return `${domain}/r/${linkId}`;
}

function createCloakingConfig(enableCloaking: boolean) {
  if (!enableCloaking) {
    return {
      userAgentRotation: false,
      referrerSpoofing: false,
      delayRedirect: false,
      javascriptRedirect: false
    };
  }

  return {
    userAgentRotation: true,
    referrerSpoofing: true,
    delayRedirect: true,
    javascriptRedirect: true
  };
}

async function createShortUrl(originalUrl: string, customAlias?: string, customDomain?: string): Promise<string> {
  // If no Short.io API key, return the original URL
  if (!shortIoApiKey()) {
    return originalUrl;
  }

  try {
    const domain = customDomain ? new URL(customDomain).hostname : "9qr.de";
    
    const response = await fetch("https://api.short.io/links", {
      method: "POST",
      headers: {
        "Authorization": shortIoApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        originalURL: originalUrl,
        domain: domain,
        allowDuplicates: true,
        alias: customAlias,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.shortURL;
    } else {
      console.warn("Short.io API failed:", response.status, response.statusText);
      return originalUrl;
    }
  } catch (error) {
    console.warn("Failed to create short URL:", error);
    return originalUrl;
  }
}

// Creates multiple affiliate links in bulk for efficient campaign setup.
export const bulkCreate = api<BulkCreateLinksRequest, BulkCreateLinksResponse>(
  { expose: true, method: "POST", path: "/links/bulk" },
  async (req) => {
    const { urls, campaignId, userId, trackingParams = {}, enableCloaking = false, customDomain } = req;

    if (!urls.length) {
      throw APIError.invalidArgument("At least one URL is required");
    }

    if (!campaignId || !userId) {
      throw APIError.invalidArgument("Campaign ID and User ID are required");
    }

    try {
      const links = await loadLinks();
      const results: Array<{
        id: string;
        rawUrl: string;
        shortUrl: string;
        cloakedUrl: string;
        customAlias?: string;
        tags: string[];
      }> = [];
      const errors: string[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (const urlData of urls) {
        try {
          // Validate URL
          new URL(urlData.rawUrl);

          // Create link ID
          const linkId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;

          // Add default tracking parameters
          const finalTrackingParams = {
            uid: userId,
            cid: campaignId,
            ts: Date.now().toString(),
            ref: 'bulk',
            src: 'campaign',
            lid: linkId,
            ...trackingParams,
          };

          // Build URL with tracking parameters
          const url = new URL(urlData.rawUrl);
          Object.entries(finalTrackingParams).forEach(([key, value]) => {
            url.searchParams.set(key, value);
          });

          const trackedUrl = url.toString();

          // Generate cloaked URL
          const cloakedUrl = generateCloakedUrl(linkId, customDomain);

          // Create short URL
          const shortUrl = await createShortUrl(cloakedUrl, urlData.customAlias, customDomain);

          // Create cloaking configuration
          const cloakingConfig = createCloakingConfig(enableCloaking);

          // Create new link
          const createdAt = new Date().toISOString();
          const newLink: LinkData = {
            id: linkId,
            rawUrl: urlData.rawUrl,
            shortUrl,
            cloakedUrl,
            campaignId,
            userId,
            trackingParams: JSON.stringify(finalTrackingParams),
            createdAt,
            customAlias: urlData.customAlias,
            tags: JSON.stringify(urlData.tags || []),
            status: 'active',
            notes: '',
            customDomain,
            enableCloaking: enableCloaking.toString(),
            cloakingConfig: JSON.stringify(cloakingConfig)
          };

          links.push(newLink);

          results.push({
            id: linkId,
            rawUrl: urlData.rawUrl,
            shortUrl,
            cloakedUrl,
            customAlias: urlData.customAlias,
            tags: urlData.tags || []
          });

          successCount++;
        } catch (error) {
          failureCount++;
          errors.push(`Failed to create link for ${urlData.rawUrl}: ${error}`);
        }
      }

      // Save all links
      await saveLinks(links);

      return {
        links: results,
        successCount,
        failureCount,
        errors
      };
    } catch (error) {
      console.error("Bulk link creation error:", error);
      throw APIError.internal("Failed to create links in bulk");
    }
  }
);
