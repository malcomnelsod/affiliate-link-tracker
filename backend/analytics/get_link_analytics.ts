import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = SQLDatabase.named("analytics");

export interface GetLinkAnalyticsRequest {
  linkId: string;
}

export interface ClickData {
  id: string;
  linkId: string;
  timestamp: Date;
  userAgent: string | null;
  ipAddress: string | null;
  geoLocation: string | null;
}

export interface LinkAnalytics {
  linkId: string;
  totalClicks: number;
  uniqueClicks: number;
  clicks: ClickData[];
}

// Retrieves detailed analytics for a specific affiliate link.
export const getLinkAnalytics = api<GetLinkAnalyticsRequest, LinkAnalytics>(
  { expose: true, method: "GET", path: "/analytics/link/:linkId" },
  async (req) => {
    const { linkId } = req;

    // Get total clicks
    const totalResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(*) as count FROM clicks WHERE link_id = ${linkId}
    `;
    const totalClicks = totalResult?.count || 0;

    // Get unique clicks (by IP address)
    const uniqueResult = await db.queryRow<{ count: number }>`
      SELECT COUNT(DISTINCT ip_address) as count 
      FROM clicks 
      WHERE link_id = ${linkId} AND ip_address IS NOT NULL
    `;
    const uniqueClicks = uniqueResult?.count || 0;

    // Get all clicks
    const clicks: ClickData[] = [];
    const clickRows = db.query<{
      id: string;
      link_id: string;
      timestamp: Date;
      user_agent: string | null;
      ip_address: string | null;
      geo_location: string | null;
    }>`
      SELECT id, link_id, timestamp, user_agent, ip_address, geo_location
      FROM clicks
      WHERE link_id = ${linkId}
      ORDER BY timestamp DESC
    `;

    for await (const row of clickRows) {
      clicks.push({
        id: row.id,
        linkId: row.link_id,
        timestamp: row.timestamp,
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        geoLocation: row.geo_location,
      });
    }

    return {
      linkId,
      totalClicks,
      uniqueClicks,
      clicks,
    };
  }
);
