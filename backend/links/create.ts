import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { secret } from "encore.dev/config";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });
const shortIoApiKey = secret("ShortIoApiKey");

export interface CreateLinkRequest {
  rawUrl: string;
  campaignId: string;
  userId: string;
  trackingParams?: Record<string, string>;
  customAlias?: string;
  tags?: string[];
  notes?: string;
  customDomain?: string;
  enableCloaking?: boolean;
}

export interface AffiliateLink {
  id: string;
  rawUrl: string;
  shortUrl: string;
  cloakedUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: Record<string, string>;
  createdAt: Date;
  customAlias?: string;
  tags: string[];
  status: string;
  notes: string;
  customDomain?: string;
  enableCloaking: boolean;
  cloakingConfig: {
    userAgentRotation: boolean;
    referrerSpoofing: boolean;
    delayRedirect: boolean;
    javascriptRedirect: boolean;
  };
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
    console.log("Links file doesn't exist yet, starting with empty array");
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
  
  // Fallback for development
  return 'http://localhost:4000';
}

function generateCloakedUrl(linkId: string, customDomain?: string): string {
  let domain;
  
  if (customDomain) {
    // Custom domain should be just the domain name, add https protocol
    domain = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
  } else {
    domain = getAppDomain();
  }
  
  // Remove trailing slash and ensure proper format
  const url = new URL(domain);
  domain = `${url.protocol}//${url.hostname}${url.port && url.port !== '80' && url.port !== '443' ? ':' + url.port : ''}`;
  
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
    console.log("No Short.io API key configured, using cloaked URL as short URL");
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

// Generates a new trackable affiliate link with spam bypass features.
export const create = api<CreateLinkRequest, AffiliateLink>(
  { expose: true, method: "POST", path: "/links" },
  async (req) => {
    const { 
      rawUrl, 
      campaignId, 
      userId, 
      trackingParams = {}, 
      customAlias, 
      tags = [], 
      notes = "",
      customDomain,
      enableCloaking = false
    } = req;

    // Validate URL
    try {
      new URL(rawUrl);
    } catch {
      throw APIError.invalidArgument("Invalid URL provided");
    }

    if (!campaignId || !userId) {
      throw APIError.invalidArgument("Campaign ID and User ID are required");
    }

    try {
      // Create link ID first
      const linkId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;

      // Add default tracking parameters with obfuscation
      const obfuscatedParams = {
        uid: userId,
        cid: campaignId,
        ts: Date.now().toString(),
        ref: 'organic',
        src: 'email',
        lid: linkId,
        ...trackingParams,
      };

      // Build URL with tracking parameters
      const url = new URL(rawUrl);
      Object.entries(obfuscatedParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });

      const trackedUrl = url.toString();

      // Generate cloaked URL using the app domain or custom domain
      const cloakedUrl = generateCloakedUrl(linkId, customDomain);

      // Create short URL using Short.io API (with fallback to cloaked URL)
      const shortUrl = await createShortUrl(cloakedUrl, customAlias, customDomain);

      // Load existing links
      const links = await loadLinks();

      // Create cloaking configuration
      const cloakingConfig = createCloakingConfig(enableCloaking);

      // Create new link
      const createdAt = new Date().toISOString();
      const newLink: LinkData = {
        id: linkId,
        rawUrl,
        shortUrl,
        cloakedUrl,
        campaignId,
        userId,
        trackingParams: JSON.stringify(obfuscatedParams),
        createdAt,
        customAlias,
        tags: JSON.stringify(tags),
        status: 'active',
        notes,
        customDomain,
        enableCloaking: enableCloaking.toString(),
        cloakingConfig: JSON.stringify(cloakingConfig)
      };

      links.push(newLink);

      // Save links
      await saveLinks(links);

      console.log(`Link created successfully: ${linkId}`);
      console.log(`Cloaked URL: ${cloakedUrl}`);
      console.log(`Short URL: ${shortUrl}`);

      return {
        id: linkId,
        rawUrl,
        shortUrl,
        cloakedUrl,
        campaignId,
        userId,
        trackingParams: obfuscatedParams,
        createdAt: new Date(createdAt),
        customAlias,
        tags,
        status: 'active',
        notes,
        customDomain,
        enableCloaking,
        cloakingConfig
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Link creation error:", error);
      throw APIError.internal("Failed to create link");
    }
  }
);
