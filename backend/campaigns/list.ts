import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";

const dataBucket = new Bucket("app-data");

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

// Retrieves all campaigns for a user.
export const list = api<ListCampaignsRequest, ListCampaignsResponse>(
  { expose: true, method: "GET", path: "/campaigns" },
  async (req) => {
    const { userId } = req;

    // Load campaigns from CSV
    let campaigns: CampaignData[] = [];
    try {
      const campaignsData = await dataBucket.download("campaigns.csv");
      const csvContent = campaignsData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        campaigns = lines.slice(1).map(line => {
          const [id, name, campaignUserId, createdAt] = line.split(',');
          return {
            id,
            name,
            userId: campaignUserId,
            createdAt
          };
        });
      }
    } catch (error) {
      // File doesn't exist yet, return empty array
    }

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
  }
);
