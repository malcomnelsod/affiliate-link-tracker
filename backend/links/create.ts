import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { secret } from "encore.dev/config";

const dataBucket = new Bucket("app-data");
const shortIoApiKey = secret("ShortIoApiKey");

export interface CreateLinkRequest {
  rawUrl: string;
  campaignId: string;
  userId: string;
  trackingParams?: Record<string, string>;
}

export interface AffiliateLink {
  id: string;
  rawUrl: string;
  shortUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: Record<string, string>;
  createdAt: Date;
}

interface LinkData {
  id: string;
  rawUrl: string;
  shortUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: string;
  createdAt: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Generates a new trackable affiliate link with spam bypass features.
export const create = api<CreateLinkRequest, AffiliateLink>(
  { expose: true, method: "POST", path: "/links" },
  async (req) => {
    const { rawUrl, campaignId, userId, trackingParams = {} } = req;

    // Validate URL
    try {
      new URL(rawUrl);
    } catch {
      throw APIError.invalidArgument("Invalid URL provided");
    }

    if (!campaignId || !userId) {
      throw APIError.invalidArgument("Campaign ID and User ID are required");
    }

    // Add default tracking parameters
    const finalTrackingParams = {
      user_id: userId,
      campaign_id: campaignId,
      timestamp: Date.now().toString(),
      ...trackingParams,
    };

    // Build URL with tracking parameters
    const url = new URL(rawUrl);
    Object.entries(finalTrackingParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const trackedUrl = url.toString();

    // Create short URL using Short.io API
    let shortUrl: string;
    try {
      const response = await fetch("https://api.short.io/links", {
        method: "POST",
        headers: {
          "Authorization": shortIoApiKey(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originalURL: trackedUrl,
          domain: "9qr.de", // Default Short.io domain
          allowDuplicates: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Short.io API error: ${response.status}`);
      }

      const data = await response.json();
      shortUrl = data.shortURL;
    } catch (error) {
      console.error("Failed to create short URL:", error);
      // Fallback to original URL if shortening fails
      shortUrl = trackedUrl;
    }

    // Load existing links
    let links: LinkData[] = [];
    try {
      const linksData = await dataBucket.download("links.csv");
      const csvContent = linksData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        links = lines.slice(1).map(line => {
          const fields = parseCSVLine(line);
          return {
            id: fields[0] || '',
            rawUrl: fields[1] || '',
            shortUrl: fields[2] || '',
            campaignId: fields[3] || '',
            userId: fields[4] || '',
            trackingParams: fields[5] || '{}',
            createdAt: fields[6] || ''
          };
        }).filter(link => link.id && link.rawUrl); // Filter out invalid entries
      }
    } catch (error) {
      // File doesn't exist yet, start with empty array
      console.log("Links file doesn't exist yet, creating new one");
    }

    // Create new link
    const linkId = Date.now().toString();
    const createdAt = new Date().toISOString();
    const newLink: LinkData = {
      id: linkId,
      rawUrl,
      shortUrl,
      campaignId,
      userId,
      trackingParams: JSON.stringify(finalTrackingParams),
      createdAt
    };

    links.push(newLink);

    // Save links back to CSV
    const csvHeader = "id,rawUrl,shortUrl,campaignId,userId,trackingParams,createdAt\n";
    const csvRows = links.map(link => 
      `${escapeCSVField(link.id)},${escapeCSVField(link.rawUrl)},${escapeCSVField(link.shortUrl)},${escapeCSVField(link.campaignId)},${escapeCSVField(link.userId)},${escapeCSVField(link.trackingParams)},${escapeCSVField(link.createdAt)}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    try {
      await dataBucket.upload("links.csv", Buffer.from(csvContent));
    } catch (error) {
      console.error("Failed to save link data:", error);
      throw APIError.internal("Failed to create link");
    }

    return {
      id: linkId,
      rawUrl,
      shortUrl,
      campaignId,
      userId,
      trackingParams: finalTrackingParams,
      createdAt: new Date(createdAt),
    };
  }
);
