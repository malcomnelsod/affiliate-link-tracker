import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";

const dataBucket = new Bucket("app-data");

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

// Retrieves all affiliate links for a user, optionally filtered by campaign.
export const list = api<ListLinksRequest, ListLinksResponse>(
  { expose: true, method: "GET", path: "/links" },
  async (req) => {
    const { userId, campaignId } = req;

    // Load links from CSV
    let links: LinkData[] = [];
    try {
      const linksData = await dataBucket.download("links.csv");
      const csvContent = linksData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        links = lines.slice(1).map(line => {
          const [id, rawUrl, shortUrl, linkCampaignId, linkUserId, trackingParams, createdAt] = line.split(',');
          return {
            id,
            rawUrl,
            shortUrl,
            campaignId: linkCampaignId,
            userId: linkUserId,
            trackingParams: trackingParams.replace(/^"|"$/g, ''), // Remove quotes
            createdAt
          };
        });
      }
    } catch (error) {
      // File doesn't exist yet, return empty array
    }

    // Filter links by user and optionally by campaign
    let filteredLinks = links.filter(link => link.userId === userId);
    if (campaignId) {
      filteredLinks = filteredLinks.filter(link => link.campaignId === campaignId);
    }

    // Convert to response format
    const userLinks = filteredLinks
      .map(link => ({
        id: link.id,
        rawUrl: link.rawUrl,
        shortUrl: link.shortUrl,
        campaignId: link.campaignId,
        userId: link.userId,
        trackingParams: JSON.parse(link.trackingParams),
        createdAt: new Date(link.createdAt),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { links: userLinks };
  }
);
