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
}

export interface BulkCreateLinksResponse {
  links: Array<{
    id: string;
    rawUrl: string;
    shortUrl: string;
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
  campaignId: string;
  userId: string;
  trackingParams: string;
  createdAt: string;
  customAlias?: string;
  tags: string;
  status: string;
  notes: string;
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
        createdAt: fields[6] || '',
        customAlias: fields[7] || undefined,
        tags: fields[8] || '[]',
        status: fields[9] || 'active',
        notes: fields[10] || ''
      };
    }).filter(link => link.id && link.rawUrl);
  } catch (error) {
    return [];
  }
}

async function saveLinks(links: LinkData[]): Promise<void> {
  const headers = ['id', 'rawUrl', 'shortUrl', 'campaignId', 'userId', 'trackingParams', 'createdAt', 'customAlias', 'tags', 'status', 'notes'];
  const rows = links.map(link => [
    link.id,
    link.rawUrl,
    link.shortUrl,
    link.campaignId,
    link.userId,
    link.trackingParams,
    link.createdAt,
    link.customAlias || '',
    link.tags,
    link.status,
    link.notes
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("links.csv", Buffer.from(csvContent));
}

// Creates multiple affiliate links in bulk for efficient campaign setup.
export const bulkCreate = api<BulkCreateLinksRequest, BulkCreateLinksResponse>(
  { expose: true, method: "POST", path: "/links/bulk" },
  async (req) => {
    const { urls, campaignId, userId, trackingParams = {} } = req;

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

          // Add default tracking parameters
          const finalTrackingParams = {
            user_id: userId,
            campaign_id: campaignId,
            timestamp: Date.now().toString(),
            ...trackingParams,
          };

          // Build URL with tracking parameters
          const url = new URL(urlData.rawUrl);
          Object.entries(finalTrackingParams).forEach(([key, value]) => {
            url.searchParams.set(key, value);
          });

          const trackedUrl = url.toString();

          // Create short URL
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
                alias: urlData.customAlias,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              shortUrl = data.shortURL;
            }
          } catch (error) {
            console.warn("Failed to create short URL, using tracked URL as fallback:", error);
          }

          // Create new link
          const linkId = `${Date.now()}_${Math.random().toString(36).substring(2)}`;
          const createdAt = new Date().toISOString();
          const newLink: LinkData = {
            id: linkId,
            rawUrl: urlData.rawUrl,
            shortUrl,
            campaignId,
            userId,
            trackingParams: JSON.stringify(finalTrackingParams),
            createdAt,
            customAlias: urlData.customAlias,
            tags: JSON.stringify(urlData.tags || []),
            status: 'active',
            notes: ''
          };

          links.push(newLink);

          results.push({
            id: linkId,
            rawUrl: urlData.rawUrl,
            shortUrl,
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
