import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";

const dataBucket = new Bucket("app-data");

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

// Creates a new campaign for organizing affiliate links.
export const create = api<CreateCampaignRequest, Campaign>(
  { expose: true, method: "POST", path: "/campaigns" },
  async (req) => {
    const { name, userId } = req;

    if (!name.trim()) {
      throw APIError.invalidArgument("Campaign name is required");
    }

    // Load existing campaigns
    let campaigns: CampaignData[] = [];
    try {
      const campaignsData = await dataBucket.download("campaigns.csv");
      const csvContent = campaignsData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        campaigns = lines.slice(1).map(line => {
          const [id, campaignName, campaignUserId, createdAt] = line.split(',');
          return {
            id,
            name: campaignName,
            userId: campaignUserId,
            createdAt
          };
        });
      }
    } catch (error) {
      // File doesn't exist yet, start with empty array
    }

    // Create new campaign
    const campaignId = Date.now().toString();
    const createdAt = new Date().toISOString();
    const newCampaign: CampaignData = {
      id: campaignId,
      name,
      userId,
      createdAt
    };

    campaigns.push(newCampaign);

    // Save campaigns back to CSV
    const csvHeader = "id,name,userId,createdAt\n";
    const csvRows = campaigns.map(campaign => 
      `${campaign.id},${campaign.name},${campaign.userId},${campaign.createdAt}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    await dataBucket.upload("campaigns.csv", Buffer.from(csvContent));

    return {
      id: campaignId,
      name,
      userId,
      createdAt: new Date(createdAt),
    };
  }
);
