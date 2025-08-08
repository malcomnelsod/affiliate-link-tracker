import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface GetCampaignAnalyticsRequest {
  campaignId: string;
  userId: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CampaignAnalytics {
  campaignId: string;
  totalLinks: number;
  totalClicks: number;
  uniqueClicks: number;
  conversionRate: number;
  topPerformingLinks: Array<{
    linkId: string;
    shortUrl: string;
    clicks: number;
  }>;
  clicksByDate: Array<{
    date: string;
    clicks: number;
  }>;
  clicksByCountry: Array<{
    country: string;
    clicks: number;
  }>;
  clicksByDevice: Array<{
    device: string;
    clicks: number;
  }>;
}

async function loadLinks() {
  try {
    const linksData = await dataBucket.download("links.csv");
    const csvContent = linksData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        rawUrl: fields[1] || '',
        shortUrl: fields[2] || '',
        campaignId: fields[3] || '',
        userId: fields[4] || '',
        trackingParams: fields[5] || '{}',
        createdAt: fields[6] || '',
        customAlias: fields[7] || undefined,
        tags: fields[8] || '[]',
        status: fields[9] || 'active',
        notes: fields[10] || ''
      };
    }).filter(link => link.id && link.rawUrl);
  } catch (error) {
    return [];
  }
}

async function loadClicks() {
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

function getDeviceType(userAgent: string): string {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'Mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'Tablet';
  } else {
    return 'Desktop';
  }
}

function getCountryFromGeo(geoLocation: string): string {
  if (!geoLocation) return 'Unknown';
  // Simple extraction - in real app you'd use proper geo parsing
  return geoLocation.split(',')[0] || 'Unknown';
}

// Retrieves comprehensive analytics for a specific campaign.
export const getCampaignAnalytics = api<GetCampaignAnalyticsRequest, CampaignAnalytics>(
  { expose: true, method: "GET", path: "/analytics/campaign/:campaignId" },
  async (req) => {
    const { campaignId, userId, dateFrom, dateTo } = req;

    try {
      const [links, clicks] = await Promise.all([loadLinks(), loadClicks()]);

      // Filter links for this campaign and user
      const campaignLinks = links.filter(link => 
        link.campaignId === campaignId && link.userId === userId
      );

      const linkIds = campaignLinks.map(link => link.id);

      // Filter clicks for campaign links
      let campaignClicks = clicks.filter(click => linkIds.includes(click.linkId));

      // Apply date filters
      if (dateFrom || dateTo) {
        campaignClicks = campaignClicks.filter(click => {
          const clickDate = new Date(click.timestamp);
          if (dateFrom && clickDate < new Date(dateFrom)) return false;
          if (dateTo && clickDate > new Date(dateTo)) return false;
          return true;
        });
      }

      // Calculate basic metrics
      const totalLinks = campaignLinks.length;
      const totalClicks = campaignClicks.length;
      const uniqueIps = new Set(campaignClicks.filter(click => click.ipAddress).map(click => click.ipAddress));
      const uniqueClicks = uniqueIps.size;
      const conversionRate = totalClicks > 0 ? (uniqueClicks / totalClicks) * 100 : 0;

      // Top performing links
      const linkClickCounts = campaignClicks.reduce((acc, click) => {
        acc[click.linkId] = (acc[click.linkId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topPerformingLinks = Object.entries(linkClickCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([linkId, clicks]) => {
          const link = campaignLinks.find(l => l.id === linkId);
          return {
            linkId,
            shortUrl: link?.shortUrl || '',
            clicks
          };
        });

      // Clicks by date
      const clicksByDateMap = campaignClicks.reduce((acc, click) => {
        const date = new Date(click.timestamp).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const clicksByDate = Object.entries(clicksByDateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, clicks]) => ({ date, clicks }));

      // Clicks by country
      const clicksByCountryMap = campaignClicks.reduce((acc, click) => {
        const country = getCountryFromGeo(click.geoLocation);
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const clicksByCountry = Object.entries(clicksByCountryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([country, clicks]) => ({ country, clicks }));

      // Clicks by device
      const clicksByDeviceMap = campaignClicks.reduce((acc, click) => {
        const device = getDeviceType(click.userAgent);
        acc[device] = (acc[device] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const clicksByDevice = Object.entries(clicksByDeviceMap)
        .map(([device, clicks]) => ({ device, clicks }));

      return {
        campaignId,
        totalLinks,
        totalClicks,
        uniqueClicks,
        conversionRate,
        topPerformingLinks,
        clicksByDate,
        clicksByCountry,
        clicksByDevice
      };
    } catch (error) {
      console.error("Get campaign analytics error:", error);
      return {
        campaignId,
        totalLinks: 0,
        totalClicks: 0,
        uniqueClicks: 0,
        conversionRate: 0,
        topPerformingLinks: [],
        clicksByDate: [],
        clicksByCountry: [],
        clicksByDevice: []
      };
    }
  }
);
