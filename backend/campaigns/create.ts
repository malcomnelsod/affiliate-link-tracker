import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface CreateCampaignRequest {
  name: string;
  userId: string;
  description?: string;
  tags?: string[];
  budget?: number;
  targetUrl?: string;
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
    console.log("Campaigns file doesn't exist yet, starting with empty array");
    return [];
  }
}

async function saveCampaigns(campaigns: CampaignData[]): Promise<void> {
  const headers = ['id', 'name', 'userId', 'createdAt', 'description', 'status', 'tags', 'budget', 'targetUrl', 'updatedAt'];
  const rows = campaigns.map(campaign => [
    campaign.id,
    campaign.name,
    campaign.userId,
    campaign.createdAt,
    campaign.description,
    campaign.status,
    campaign.tags,
    campaign.budget,
    campaign.targetUrl,
    campaign.updatedAt
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("campaigns.csv", Buffer.from(csvContent));
  console.log(`Saved ${campaigns.length} campaigns to CSV`);
}

// Creates a new campaign for organizing affiliate links.
export const create = api<CreateCampaignRequest, Campaign>(
  { expose: true, method: "POST", path: "/campaigns" },
  async (req) => {
    const { name, userId, description = "", tags = [], budget = 0, targetUrl = "" } = req;

    console.log(`Creating campaign: ${name} for user: ${userId}`);

    if (!name.trim()) {
      throw APIError.invalidArgument("Campaign name is required");
    }

    if (!userId) {
      throw APIError.invalidArgument("User ID is required");
    }

    try {
      // Load existing campaigns
      const campaigns = await loadCampaigns();
      console.log(`Loaded ${campaigns.length} existing campaigns`);

      // Create new campaign
      const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const createdAt = new Date().toISOString();
      const newCampaign: CampaignData = {
        id: campaignId,
        name: name.trim(),
        userId,
        createdAt,
        description,
        status: 'active',
        tags: JSON.stringify(tags),
        budget: budget.toString(),
        targetUrl,
        updatedAt: createdAt
      };

      campaigns.push(newCampaign);

      // Save campaigns
      await saveCampaigns(campaigns);

      console.log(`Campaign created successfully: ${campaignId}`);

      return {
        id: campaignId,
        name: name.trim(),
        userId,
        createdAt: new Date(createdAt),
        description,
        status: 'active',
        tags,
        budget,
        targetUrl,
        updatedAt: new Date(createdAt)
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
