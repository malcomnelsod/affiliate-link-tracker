import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

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

interface LinkData {
  id: string;
  rawUrl: string;
  shortUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: string;
  createdAt: string;
}

async function loadLinks(): Promise<LinkData[]> {
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
        createdAt: fields[6] || ''
      };
    }).filter(link => link.id && link.rawUrl);
  } catch (error) {
    return [];
  }
}

// Retrieves all affiliate links for a user, optionally filtered by campaign.
export const list = api<ListLinksRequest, ListLinksResponse>(
  { expose: true, method: "GET", path: "/links" },
  async (req) => {
    const { userId, campaignId } = req;

    try {
      // Load links from CSV
      const links = await loadLinks();

      // Filter links by user and optionally by campaign
      let filteredLinks = links.filter(link => link.userId === userId);
      if (campaignId) {
        filteredLinks = filteredLinks.filter(link => link.campaignId === campaignId);
      }

      // Convert to response format
      const userLinks = filteredLinks
        .map(link => {
          let trackingParams = {};
          try {
            trackingParams = JSON.parse(link.trackingParams);
          } catch (error) {
            console.error("Failed to parse tracking params:", error);
            trackingParams = {};
          }
          
          return {
            id: link.id,
            rawUrl: link.rawUrl,
            shortUrl: link.shortUrl,
            campaignId: link.campaignId,
            userId: link.userId,
            trackingParams,
            createdAt: new Date(link.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { links: userLinks };
    } catch (error) {
      console.error("List links error:", error);
      return { links: [] };
    }
  }
);
