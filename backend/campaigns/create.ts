import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = new SQLDatabase("campaigns", {
  migrations: "./migrations",
});

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

// Creates a new campaign for organizing affiliate links.
export const create = api<CreateCampaignRequest, Campaign>(
  { expose: true, method: "POST", path: "/campaigns" },
  async (req) => {
    const { name, userId } = req;

    if (!name.trim()) {
      throw APIError.invalidArgument("Campaign name is required");
    }

    const campaign = await db.queryRow<{
      id: string;
      name: string;
      user_id: string;
      created_at: Date;
    }>`
      INSERT INTO campaigns (name, user_id, created_at)
      VALUES (${name}, ${userId}, NOW())
      RETURNING id, name, user_id, created_at
    `;

    if (!campaign) {
      throw APIError.internal("Failed to create campaign");
    }

    return {
      id: campaign.id,
      name: campaign.name,
      userId: campaign.user_id,
      createdAt: campaign.created_at,
    };
  }
);
