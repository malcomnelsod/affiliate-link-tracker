import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface CreateCampaignRequest {
  name: string;
  userId: string;
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
    console.log("Campaigns file doesn't exist yet, starting with empty array");
    return [];
  }
}

async function saveCampaigns(campaigns: CampaignData[]): Promise<void> {
  const headers = ['id', 'name', 'userId', 'createdAt'];
  const rows = campaigns.map(campaign => [
    campaign.id,
    campaign.name,
    campaign.userId,
    campaign.createdAt
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("campaigns.csv", Buffer.from(csvContent));
}

// Creates a new campaign for organizing affiliate links.
export const create = api<CreateCampaignRequest, Campaign>(
  { expose: true, method: "POST", path: "/campaigns" },
  async (req) => {
    const { name, userId } = req;

    if (!name.trim()) {
      throw APIError.invalidArgument("Campaign name is required");
    }

    if (!userId) {
      throw APIError.invalidArgument("User ID is required");
    }

    try {
      // Load existing campaigns
      const campaigns = await loadCampaigns();

      // Create new campaign
      const campaignId = Date.now().toString();
      const createdAt = new Date().toISOString();
      const newCampaign: CampaignData = {
        id: campaignId,
        name: name.trim(),
        userId,
        createdAt
      };

      campaigns.push(newCampaign);

      // Save campaigns
      await saveCampaigns(campaigns);

      return {
        id: campaignId,
        name: name.trim(),
        userId,
        createdAt: new Date(createdAt),
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Campaign creation error:", error);
      throw APIError.internal("Failed to create campaign");
    }
  }
);
