import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

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

interface ClickDataRaw {
  id: string;
  linkId: string;
  timestamp: string;
  userAgent: string;
  ipAddress: string;
  geoLocation: string;
}

async function loadClicks(): Promise<ClickDataRaw[]> {
  try {
    const clicksData = await dataBucket.download("clicks.csv");
    const csvContent = clicksData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        linkId: fields[1] || '',
        timestamp: fields[2] || '',
        userAgent: fields[3] || '',
        ipAddress: fields[4] || '',
        geoLocation: fields[5] || ''
      };
    }).filter(click => click.id && click.linkId);
  } catch (error) {
    return [];
  }
}

// Retrieves detailed analytics for a specific affiliate link.
export const getLinkAnalytics = api<GetLinkAnalyticsRequest, LinkAnalytics>(
  { expose: true, method: "GET", path: "/analytics/link/:linkId" },
  async (req) => {
    const { linkId } = req;

    try {
      // Load clicks from CSV
      const clicks = await loadClicks();

      // Filter clicks for this link
      const linkClicks = clicks.filter(click => click.linkId === linkId);

      // Calculate total clicks
      const totalClicks = linkClicks.length;

      // Calculate unique clicks (by IP address)
      const uniqueIps = new Set(linkClicks.filter(click => click.ipAddress).map(click => click.ipAddress));
      const uniqueClicks = uniqueIps.size;

      // Convert to response format
      const clicksResponse: ClickData[] = linkClicks
        .map(click => ({
          id: click.id,
          linkId: click.linkId,
          timestamp: new Date(click.timestamp),
          userAgent: click.userAgent || null,
          ipAddress: click.ipAddress || null,
          geoLocation: click.geoLocation || null,
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return {
        linkId,
        totalClicks,
        uniqueClicks,
        clicks: clicksResponse,
      };
    } catch (error) {
      console.error("Get link analytics error:", error);
      return {
        linkId,
        totalClicks: 0,
        uniqueClicks: 0,
        clicks: [],
      };
    }
  }
);
