import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { secret } from "encore.dev/config";

const db = new SQLDatabase("links", {
  migrations: "./migrations",
});

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

    // Store link in database
    const link = await db.queryRow<{
      id: string;
      raw_url: string;
      short_url: string;
      campaign_id: string;
      user_id: string;
      tracking_params: string;
      created_at: Date;
    }>`
      INSERT INTO links (raw_url, short_url, campaign_id, user_id, tracking_params, created_at)
      VALUES (${rawUrl}, ${shortUrl}, ${campaignId}, ${userId}, ${JSON.stringify(finalTrackingParams)}, NOW())
      RETURNING id, raw_url, short_url, campaign_id, user_id, tracking_params, created_at
    `;

    if (!link) {
      throw APIError.internal("Failed to create link");
    }

    return {
      id: link.id,
      rawUrl: link.raw_url,
      shortUrl: link.short_url,
      campaignId: link.campaign_id,
      userId: link.user_id,
      trackingParams: JSON.parse(link.tracking_params),
      createdAt: link.created_at,
    };
  }
);
