import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { Header } from "encore.dev/api";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface TrackClickRequest {
  linkId: string;
  userAgent?: Header<"User-Agent">;
  ipAddress?: string;
  geoLocation?: string;
}

export interface TrackClickResponse {
  success: boolean;
}

interface ClickData {
  id: string;
  linkId: string;
  timestamp: string;
  userAgent: string;
  ipAddress: string;
  geoLocation: string;
}

async function loadClicks(): Promise<ClickData[]> {
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
    console.log("Clicks file doesn't exist yet, starting with empty array");
    return [];
  }
}

async function saveClicks(clicks: ClickData[]): Promise<void> {
  const headers = ['id', 'linkId', 'timestamp', 'userAgent', 'ipAddress', 'geoLocation'];
  const rows = clicks.map(click => [
    click.id,
    click.linkId,
    click.timestamp,
    click.userAgent,
    click.ipAddress,
    click.geoLocation
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("clicks.csv", Buffer.from(csvContent));
}

// Records a click event for analytics tracking.
export const trackClick = api<TrackClickRequest, TrackClickResponse>(
  { expose: true, method: "POST", path: "/analytics/click" },
  async (req) => {
    const { linkId, userAgent, ipAddress, geoLocation } = req;

    if (!linkId) {
      return { success: false };
    }

    try {
      // Load existing clicks
      const clicks = await loadClicks();

      // Create new click record
      const clickId = Date.now().toString();
      const newClick: ClickData = {
        id: clickId,
        linkId,
        timestamp: new Date().toISOString(),
        userAgent: userAgent || '',
        ipAddress: ipAddress || '',
        geoLocation: geoLocation || ''
      };

      clicks.push(newClick);

      // Save clicks
      await saveClicks(clicks);

      return { success: true };
    } catch (error) {
      console.error("Track click error:", error);
      return { success: false };
    }
  }
);
