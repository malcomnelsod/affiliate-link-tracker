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
        campaignId: fields[3] || '',
        userId: fields[4] || '',
        trackingParams: fields[5] || '{}',
        createdAt: fields[6] || ''
      };
    }).filter(link => link.id && link.rawUrl);
  } catch (error) {
    console.log("Links file doesn't exist yet, starting with empty array");
    return [];
  }
}

async function saveLinks(links: LinkData[]): Promise<void> {
  const headers = ['id', 'rawUrl', 'shortUrl', 'campaignId', 'userId', 'trackingParams', 'createdAt'];
  const rows = links.map(link => [
    link.id,
    link.rawUrl,
    link.shortUrl,
    link.campaignId,
    link.userId,
    link.trackingParams,
    link.createdAt
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("links.csv", Buffer.from(csvContent));
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

    try {
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

      // Create short URL using Short.io API (with fallback)
      let shortUrl: string = trackedUrl;
      try {
        const response = await fetch("https://api.short.io/links", {
          method: "POST",
          headers: {
            "Authorization": shortIoApiKey(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            originalURL: trackedUrl,
            domain: "9qr.de",
            allowDuplicates: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          shortUrl = data.shortURL;
        } else {
          console.warn("Short.io API failed, using tracked URL as fallback");
        }
      } catch (error) {
        console.warn("Failed to create short URL, using tracked URL as fallback:", error);
      }

      // Load existing links
      const links = await loadLinks();

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

      // Save links
      await saveLinks(links);

      return {
        id: linkId,
        rawUrl,
        shortUrl,
        campaignId,
        userId,
        trackingParams: finalTrackingParams,
        createdAt: new Date(createdAt),
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
