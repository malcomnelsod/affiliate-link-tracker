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

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Records a click event for analytics tracking.
export const trackClick = api<TrackClickRequest, TrackClickResponse>(
  { expose: true, method: "POST", path: "/analytics/click" },
  async (req) => {
    const { linkId, userAgent, ipAddress, geoLocation } = req;

    if (!linkId) {
      return { success: false };
    }

    // Load existing clicks
    let clicks: ClickData[] = [];
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
      // File doesn't exist yet, start with empty array
      console.log("Clicks file doesn't exist yet, creating new one");
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
      `${escapeCSVField(click.id)},${escapeCSVField(click.linkId)},${escapeCSVField(click.timestamp)},${escapeCSVField(click.userAgent)},${escapeCSVField(click.ipAddress)},${escapeCSVField(click.geoLocation)}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    try {
      await dataBucket.upload("clicks.csv", Buffer.from(csvContent));
    } catch (error) {
      console.error("Failed to save click data:", error);
      return { success: false };
    }

    return { success: true };
  }
);
