import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = SQLDatabase.named("links");

export interface ListLinksRequest {
  userId: string;
  campaignId?: string;
}

export interface ListLinksResponse {
  links: AffiliateLink[];
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

// Retrieves all affiliate links for a user, optionally filtered by campaign.
export const list = api<ListLinksRequest, ListLinksResponse>(
  { expose: true, method: "GET", path: "/links" },
  async (req) => {
    const { userId, campaignId } = req;

    const links: AffiliateLink[] = [];
    let query;

    if (campaignId) {
      query = db.query<{
        id: string;
        raw_url: string;
        short_url: string;
        campaign_id: string;
        user_id: string;
        tracking_params: string;
        created_at: Date;
      }>`
        SELECT id, raw_url, short_url, campaign_id, user_id, tracking_params, created_at
        FROM links
        WHERE user_id = ${userId} AND campaign_id = ${campaignId}
        ORDER BY created_at DESC
      `;
    } else {
      query = db.query<{
        id: string;
        raw_url: string;
        short_url: string;
        campaign_id: string;
        user_id: string;
        tracking_params: string;
        created_at: Date;
      }>`
        SELECT id, raw_url, short_url, campaign_id, user_id, tracking_params, created_at
        FROM links
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
    }

    for await (const row of query) {
      links.push({
        id: row.id,
        rawUrl: row.raw_url,
        shortUrl: row.short_url,
        campaignId: row.campaign_id,
        userId: row.user_id,
        trackingParams: JSON.parse(row.tracking_params),
        createdAt: row.created_at,
      });
    }

    return { links };
  }
);
