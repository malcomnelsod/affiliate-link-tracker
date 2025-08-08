import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface UpdateCampaignRequest {
  campaignId: string;
  userId: string;
  name?: string;
  description?: string;
  status?: 'active' | 'paused' | 'archived';
  tags?: string[];
  budget?: number;
  targetUrl?: string;
}

export interface UpdateCampaignResponse {
  success: boolean;
  campaign?: {
    id: string;
    name: string;
    description: string;
    status: string;
    tags: string[];
    budget: number;
    targetUrl: string;
    updatedAt: Date;
  };
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
}

// Updates an existing campaign with new settings and metadata.
export const update = api<UpdateCampaignRequest, UpdateCampaignResponse>(
  { expose: true, method: "PUT", path: "/campaigns/:campaignId" },
  async (req) => {
    const { campaignId, userId, name, description, status, tags, budget, targetUrl } = req;

    if (!campaignId || !userId) {
      throw APIError.invalidArgument("Campaign ID and User ID are required");
    }

    try {
      const campaigns = await loadCampaigns();
      const campaignIndex = campaigns.findIndex(campaign => 
        campaign.id === campaignId && campaign.userId === userId
      );

      if (campaignIndex === -1) {
        throw APIError.notFound("Campaign not found");
      }

      // Update campaign data
      const updatedAt = new Date().toISOString();
      
      if (name !== undefined) {
        campaigns[campaignIndex].name = name;
      }
      if (description !== undefined) {
        campaigns[campaignIndex].description = description;
      }
      if (status !== undefined) {
        campaigns[campaignIndex].status = status;
      }
      if (tags !== undefined) {
        campaigns[campaignIndex].tags = JSON.stringify(tags);
      }
      if (budget !== undefined) {
        campaigns[campaignIndex].budget = budget.toString();
      }
      if (targetUrl !== undefined) {
        campaigns[campaignIndex].targetUrl = targetUrl;
      }
      
      campaigns[campaignIndex].updatedAt = updatedAt;

      await saveCampaigns(campaigns);

      const updatedCampaign = campaigns[campaignIndex];
      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(updatedCampaign.tags);
      } catch (error) {
        parsedTags = [];
      }

      return {
        success: true,
        campaign: {
          id: updatedCampaign.id,
          name: updatedCampaign.name,
          description: updatedCampaign.description,
          status: updatedCampaign.status,
          tags: parsedTags,
          budget: parseFloat(updatedCampaign.budget) || 0,
          targetUrl: updatedCampaign.targetUrl,
          updatedAt: new Date(updatedAt)
        }
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Update campaign error:", error);
      throw APIError.internal("Failed to update campaign");
    }
  }
);
