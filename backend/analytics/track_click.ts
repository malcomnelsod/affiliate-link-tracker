import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Header } from "encore.dev/api";

const db = new SQLDatabase("analytics", {
  migrations: "./migrations",
});

export interface TrackClickRequest {
  linkId: string;
  userAgent?: Header<"User-Agent">;
  ipAddress?: string;
  geoLocation?: string;
}

export interface TrackClickResponse {
  success: boolean;
}

// Records a click event for analytics tracking.
export const trackClick = api<TrackClickRequest, TrackClickResponse>(
  { expose: true, method: "POST", path: "/analytics/click" },
  async (req) => {
    const { linkId, userAgent, ipAddress, geoLocation } = req;

    await db.exec`
      INSERT INTO clicks (link_id, timestamp, user_agent, ip_address, geo_location)
      VALUES (${linkId}, NOW(), ${userAgent || null}, ${ipAddress || null}, ${geoLocation || null})
    `;

    return { success: true };
  }
);
