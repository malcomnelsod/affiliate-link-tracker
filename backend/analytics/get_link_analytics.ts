import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";

const dataBucket = new Bucket("app-data");

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

// Retrieves detailed analytics for a specific affiliate link.
export const getLinkAnalytics = api<GetLinkAnalyticsRequest, LinkAnalytics>(
  { expose: true, method: "GET", path: "/analytics/link/:linkId" },
  async (req) => {
    const { linkId } = req;

    // Load clicks from CSV
    let clicks: ClickDataRaw[] = [];
    try {
      const clicksData = await dataBucket.download("clicks.csv");
      const csvContent = clicksData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        clicks = lines.slice(1).map(line => {
          const fields = parseCSVLine(line);
          return {
            id: fields[0] || '',
            linkId: fields[1] || '',
            timestamp: fields[2] || '',
            userAgent: fields[3] || '',
            ipAddress: fields[4] || '',
            geoLocation: fields[5] || ''
          };
        }).filter(click => click.id && click.linkId); // Filter out invalid entries
      }
    } catch (error) {
      // File doesn't exist yet, return empty analytics
      console.log("Clicks file doesn't exist yet");
    }

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
  }
);
