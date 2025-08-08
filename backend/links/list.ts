import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface ListLinksRequest {
  userId: string;
  campaignId?: string;
  status?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListLinksResponse {
  links: AffiliateLink[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AffiliateLink {
  id: string;
  rawUrl: string;
  shortUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: Record<string, string>;
  createdAt: Date;
  customAlias?: string;
  tags: string[];
  status: string;
  notes: string;
  clickCount?: number;
}

interface LinkData {
  id: string;
  rawUrl: string;
  shortUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: string;
  createdAt: string;
  customAlias?: string;
  tags: string;
  status: string;
  notes: string;
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

// Retrieves all affiliate links for a user with advanced filtering and pagination.
export const list = api<ListLinksRequest, ListLinksResponse>(
  { expose: true, method: "GET", path: "/links" },
  async (req) => {
    const { userId, campaignId, status, tags, search, page = 1, limit = 20 } = req;

    try {
      // Load links and clicks from CSV
      const [links, clicks] = await Promise.all([loadLinks(), loadClicks()]);

      // Count clicks per link
      const clickCounts = clicks.reduce((acc, click) => {
        acc[click.linkId] = (acc[click.linkId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Filter links by user
      let filteredLinks = links.filter(link => link.userId === userId);

      // Apply filters
      if (campaignId && campaignId !== 'all') {
        filteredLinks = filteredLinks.filter(link => link.campaignId === campaignId);
      }

      if (status && status !== 'all') {
        filteredLinks = filteredLinks.filter(link => link.status === status);
      }

      if (tags && tags.length > 0) {
        filteredLinks = filteredLinks.filter(link => {
          let linkTags: string[] = [];
          try {
            linkTags = JSON.parse(link.tags);
          } catch (error) {
            linkTags = [];
          }
          return tags.some(tag => linkTags.includes(tag));
        });
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filteredLinks = filteredLinks.filter(link => 
          link.rawUrl.toLowerCase().includes(searchLower) ||
          link.shortUrl.toLowerCase().includes(searchLower) ||
          (link.customAlias && link.customAlias.toLowerCase().includes(searchLower)) ||
          link.notes.toLowerCase().includes(searchLower)
        );
      }

      // Calculate pagination
      const total = filteredLinks.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedLinks = filteredLinks.slice(offset, offset + limit);

      // Convert to response format
      const userLinks = paginatedLinks
        .map(link => {
          let trackingParams = {};
          let linkTags: string[] = [];
          
          try {
            trackingParams = JSON.parse(link.trackingParams);
          } catch (error) {
            trackingParams = {};
          }

          try {
            linkTags = JSON.parse(link.tags);
          } catch (error) {
            linkTags = [];
          }
          
          return {
            id: link.id,
            rawUrl: link.rawUrl,
            shortUrl: link.shortUrl,
            campaignId: link.campaignId,
            userId: link.userId,
            trackingParams,
            createdAt: new Date(link.createdAt),
            customAlias: link.customAlias,
            tags: linkTags,
            status: link.status,
            notes: link.notes,
            clickCount: clickCounts[link.id] || 0
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { 
        links: userLinks,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error("List links error:", error);
      return { 
        links: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
  }
);
