import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { Header } from "encore.dev/api";

const dataBucket = new Bucket("app-data");

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

// Records a click event for analytics tracking.
export const trackClick = api<TrackClickRequest, TrackClickResponse>(
  { expose: true, method: "POST", path: "/analytics/click" },
  async (req) => {
    const { linkId, userAgent, ipAddress, geoLocation } = req;

    // Load existing clicks
    let clicks: ClickData[] = [];
    try {
      const clicksData = await dataBucket.download("clicks.csv");
      const csvContent = clicksData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        clicks = lines.slice(1).map(line => {
          const [id, clickLinkId, timestamp, clickUserAgent, clickIpAddress, clickGeoLocation] = line.split(',');
          return {
            id,
            linkId: clickLinkId,
            timestamp,
            userAgent: clickUserAgent,
            ipAddress: clickIpAddress,
            geoLocation: clickGeoLocation
          };
        });
      }
    } catch (error) {
      // File doesn't exist yet, start with empty array
    }

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

    // Save clicks back to CSV
    const csvHeader = "id,linkId,timestamp,userAgent,ipAddress,geoLocation\n";
    const csvRows = clicks.map(click => 
      `${click.id},${click.linkId},${click.timestamp},"${click.userAgent}",${click.ipAddress},${click.geoLocation}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    await dataBucket.upload("clicks.csv", Buffer.from(csvContent));

    return { success: true };
  }
);
