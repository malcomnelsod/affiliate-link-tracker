import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface ExportDataRequest {
  userId: string;
  type: 'links' | 'clicks' | 'campaigns' | 'all';
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
  format: 'csv' | 'json';
}

export interface ExportDataResponse {
  downloadUrl: string;
  filename: string;
  recordCount: number;
}

async function loadData(type: string) {
  try {
    const data = await dataBucket.download(`${type}.csv`);
    const csvContent = data.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return { headers: [], rows: [] };
    }
    
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => parseCSVLine(line));
    
    return { headers, rows };
  } catch (error) {
    return { headers: [], rows: [] };
  }
}

// Exports user data in various formats for external analysis.
export const exportData = api<ExportDataRequest, ExportDataResponse>(
  { expose: true, method: "POST", path: "/analytics/export" },
  async (req) => {
    const { userId, type, campaignId, dateFrom, dateTo, format } = req;

    try {
      let exportData: any[] = [];
      let filename = `${type}_export_${Date.now()}`;

      if (type === 'all') {
        // Export all data types
        const [links, clicks, campaigns] = await Promise.all([
          loadData('links'),
          loadData('clicks'),
          loadData('campaigns')
        ]);

        // Filter by user
        const userLinks = links.rows.filter(row => row[4] === userId); // userId is at index 4
        const userCampaigns = campaigns.rows.filter(row => row[2] === userId); // userId is at index 2
        
        const linkIds = userLinks.map(row => row[0]); // id is at index 0
        const userClicks = clicks.rows.filter(row => linkIds.includes(row[1])); // linkId is at index 1

        exportData = {
          links: userLinks,
          clicks: userClicks,
          campaigns: userCampaigns
        };
      } else {
        const data = await loadData(type);
        
        if (type === 'links') {
          exportData = data.rows.filter(row => {
            if (row[4] !== userId) return false; // userId filter
            if (campaignId && row[3] !== campaignId) return false; // campaignId filter
            return true;
          });
        } else if (type === 'campaigns') {
          exportData = data.rows.filter(row => row[2] === userId); // userId filter
        } else if (type === 'clicks') {
          // First get user's links to filter clicks
          const linksData = await loadData('links');
          const userLinkIds = linksData.rows
            .filter(row => row[4] === userId)
            .map(row => row[0]);
          
          exportData = data.rows.filter(row => {
            if (!userLinkIds.includes(row[1])) return false; // linkId filter
            
            // Date filters
            if (dateFrom || dateTo) {
              const clickDate = new Date(row[2]); // timestamp is at index 2
              if (dateFrom && clickDate < new Date(dateFrom)) return false;
              if (dateTo && clickDate > new Date(dateTo)) return false;
            }
            
            return true;
          });
        }
      }

      // Generate export content
      let exportContent: string;
      let contentType: string;

      if (format === 'json') {
        exportContent = JSON.stringify(exportData, null, 2);
        contentType = 'application/json';
        filename += '.json';
      } else {
        // CSV format
        if (type === 'all') {
          // For 'all' type, create separate sections
          const sections = Object.entries(exportData as any).map(([key, data]) => {
            if (Array.isArray(data) && data.length > 0) {
              const headers = getHeadersForType(key);
              return `\n${key.toUpperCase()}\n${createCSVContent(headers, data as string[][])}`;
            }
            return '';
          }).filter(Boolean);
          
          exportContent = sections.join('\n\n');
        } else {
          const headers = getHeadersForType(type);
          exportContent = createCSVContent(headers, exportData as string[][]);
        }
        contentType = 'text/csv';
        filename += '.csv';
      }

      // Save export file
      const exportPath = `exports/${userId}/${filename}`;
      await dataBucket.upload(exportPath, Buffer.from(exportContent));

      // Generate signed download URL
      const downloadUrl = await dataBucket.signedDownloadUrl(exportPath, { ttl: 3600 }); // 1 hour

      return {
        downloadUrl: downloadUrl.url,
        filename,
        recordCount: Array.isArray(exportData) ? exportData.length : Object.values(exportData).flat().length
      };
    } catch (error) {
      console.error("Export data error:", error);
      throw new Error("Failed to export data");
    }
  }
);

function getHeadersForType(type: string): string[] {
  switch (type) {
    case 'links':
      return ['id', 'rawUrl', 'shortUrl', 'campaignId', 'userId', 'trackingParams', 'createdAt', 'customAlias', 'tags', 'status', 'notes'];
    case 'clicks':
      return ['id', 'linkId', 'timestamp', 'userAgent', 'ipAddress', 'geoLocation'];
    case 'campaigns':
      return ['id', 'name', 'userId', 'createdAt'];
    default:
      return [];
  }
}
