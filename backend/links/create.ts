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
          const [id, linkRawUrl, linkShortUrl, linkCampaignId, linkUserId, linkTrackingParams, createdAt] = line.split(',');
          return {
            id,
            rawUrl: linkRawUrl,
            shortUrl: linkShortUrl,
            campaignId: linkCampaignId,
            userId: linkUserId,
            trackingParams: linkTrackingParams,
            createdAt
          };
        });
      }
    } catch (error) {
      // File doesn't exist yet, start with empty array
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
      `${link.id},${link.rawUrl},${link.shortUrl},${link.campaignId},${link.userId},"${link.trackingParams}",${link.createdAt}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    await dataBucket.upload("links.csv", Buffer.from(csvContent));

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
