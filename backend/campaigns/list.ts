import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface ListCampaignsRequest {
  userId: string;
}

export interface ListCampaignsResponse {
  campaigns: Campaign[];
}

export interface Campaign {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
}

interface CampaignData {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
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
        createdAt: fields[3] || ''
      };
    }).filter(campaign => campaign.id && campaign.name);
  } catch (error) {
    return [];
  }
}

// Retrieves all campaigns for a user.
export const list = api<ListCampaignsRequest, ListCampaignsResponse>(
  { expose: true, method: "GET", path: "/campaigns" },
  async (req) => {
    const { userId } = req;

    try {
      // Load campaigns from CSV
      const campaigns = await loadCampaigns();

      // Filter campaigns by user and convert to response format
      const userCampaigns = campaigns
        .filter(campaign => campaign.userId === userId)
        .map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          userId: campaign.userId,
          createdAt: new Date(campaign.createdAt),
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { campaigns: userCampaigns };
    } catch (error) {
      console.error("List campaigns error:", error);
      return { campaigns: [] };
    }
  }
);
