import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface ListCampaignsRequest {
  userId: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ListCampaignsResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Campaign {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  description: string;
  status: string;
  tags: string[];
  budget: number;
  targetUrl: string;
  updatedAt: Date;
  linkCount?: number;
  totalClicks?: number;
}

interface CampaignData {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  description: string;
  status: string;
  tags: string;
  budget: string;
  targetUrl: string;
  updatedAt: string;
}

async function loadCampaigns(): Promise<CampaignData[]> {
  try {
    const campaignsData = await dataBucket.download("campaigns.csv");
    const csvContent = campaignsData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        name: fields[1] || '',
        userId: fields[2] || '',
        createdAt: fields[3] || '',
        description: fields[4] || '',
        status: fields[5] || 'active',
        tags: fields[6] || '[]',
        budget: fields[7] || '0',
        targetUrl: fields[8] || '',
        updatedAt: fields[9] || ''
      };
    }).filter(campaign => campaign.id && campaign.name);
  } catch (error) {
    return [];
  }
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
        campaignId: fields[3] || ''
      };
    }).filter(link => link.id && link.campaignId);
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
        linkId: fields[1] || ''
      };
    }).filter(click => click.id && click.linkId);
  } catch (error) {
    return [];
  }
}

// Retrieves all campaigns for a user with enhanced metadata and statistics.
export const list = api<ListCampaignsRequest, ListCampaignsResponse>(
  { expose: true, method: "GET", path: "/campaigns" },
  async (req) => {
    const { userId, status, search, page = 1, limit = 20 } = req;

    try {
      // Load campaigns, links, and clicks from CSV
      const [campaigns, links, clicks] = await Promise.all([
        loadCampaigns(),
        loadLinks(),
        loadClicks()
      ]);

      // Count links per campaign
      const linkCounts = links.reduce((acc, link) => {
        acc[link.campaignId] = (acc[link.campaignId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Count clicks per campaign
      const linkIdToCampaign = links.reduce((acc, link) => {
        acc[link.id] = link.campaignId;
        return acc;
      }, {} as Record<string, string>);

      const clickCounts = clicks.reduce((acc, click) => {
        const campaignId = linkIdToCampaign[click.linkId];
        if (campaignId) {
          acc[campaignId] = (acc[campaignId] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Filter campaigns by user
      let filteredCampaigns = campaigns.filter(campaign => campaign.userId === userId);

      // Apply filters
      if (status) {
        filteredCampaigns = filteredCampaigns.filter(campaign => campaign.status === status);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filteredCampaigns = filteredCampaigns.filter(campaign => 
          campaign.name.toLowerCase().includes(searchLower) ||
          campaign.description.toLowerCase().includes(searchLower)
        );
      }

      // Calculate pagination
      const total = filteredCampaigns.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginatedCampaigns = filteredCampaigns.slice(offset, offset + limit);

      // Convert to response format
      const userCampaigns = paginatedCampaigns
        .map(campaign => {
          let tags: string[] = [];
          try {
            tags = JSON.parse(campaign.tags);
          } catch (error) {
            tags = [];
          }

          return {
            id: campaign.id,
            name: campaign.name,
            userId: campaign.userId,
            createdAt: new Date(campaign.createdAt),
            description: campaign.description,
            status: campaign.status,
            tags,
            budget: parseFloat(campaign.budget) || 0,
            targetUrl: campaign.targetUrl,
            updatedAt: new Date(campaign.updatedAt || campaign.createdAt),
            linkCount: linkCounts[campaign.id] || 0,
            totalClicks: clickCounts[campaign.id] || 0
          };
        })
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return { 
        campaigns: userCampaigns,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error("List campaigns error:", error);
      return { 
        campaigns: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
  }
);
