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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
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
          const fields = parseCSVLine(line);
          return {
            id: fields[0] || '',
            name: fields[1] || '',
            userId: fields[2] || '',
            createdAt: fields[3] || ''
          };
        }).filter(campaign => campaign.id && campaign.name); // Filter out invalid entries
      }
    } catch (error) {
      // File doesn't exist yet, return empty array
      console.log("Campaigns file doesn't exist yet");
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
