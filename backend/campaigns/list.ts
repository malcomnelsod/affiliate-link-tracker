import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const db = SQLDatabase.named("campaigns");

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

// Retrieves all campaigns for a user.
export const list = api<ListCampaignsRequest, ListCampaignsResponse>(
  { expose: true, method: "GET", path: "/campaigns" },
  async (req) => {
    const { userId } = req;

    const campaigns: Campaign[] = [];
    const rows = db.query<{
      id: string;
      name: string;
      user_id: string;
      created_at: Date;
    }>`
      SELECT id, name, user_id, created_at
      FROM campaigns
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    for await (const row of rows) {
      campaigns.push({
        id: row.id,
        name: row.name,
        userId: row.user_id,
        createdAt: row.created_at,
      });
    }

    return { campaigns };
  }
);
