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

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
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

    // Load existing campaigns
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
      // File doesn't exist yet, start with empty array
      console.log("Campaigns file doesn't exist yet, creating new one");
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
      `${escapeCSVField(campaign.id)},${escapeCSVField(campaign.name)},${escapeCSVField(campaign.userId)},${escapeCSVField(campaign.createdAt)}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    try {
      await dataBucket.upload("campaigns.csv", Buffer.from(csvContent));
    } catch (error) {
      console.error("Failed to save campaign data:", error);
      throw APIError.internal("Failed to create campaign");
    }

    return {
      id: campaignId,
      name,
      userId,
      createdAt: new Date(createdAt),
    };
  }
);
