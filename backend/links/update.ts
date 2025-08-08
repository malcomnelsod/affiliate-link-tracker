import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface UpdateLinkRequest {
  linkId: string;
  userId: string;
  customAlias?: string;
  tags?: string[];
  status?: 'active' | 'paused' | 'archived';
  notes?: string;
}

export interface UpdateLinkResponse {
  success: boolean;
  link?: {
    id: string;
    rawUrl: string;
    shortUrl: string;
    customAlias?: string;
    tags: string[];
    status: string;
    notes: string;
  };
}

interface LinkData {
  id: string;
  rawUrl: string;
  shortUrl: string;
  campaignId: string;
  userId: string;
  trackingParams: string;
  createdAt: string;
  customAlias?: string;
  tags: string;
  status: string;
  notes: string;
}

async function loadLinks(): Promise<LinkData[]> {
  try {
    const linksData = await dataBucket.download("links.csv");
    const csvContent = linksData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        rawUrl: fields[1] || '',
        shortUrl: fields[2] || '',
        campaignId: fields[3] || '',
        userId: fields[4] || '',
        trackingParams: fields[5] || '{}',
        createdAt: fields[6] || '',
        customAlias: fields[7] || undefined,
        tags: fields[8] || '[]',
        status: fields[9] || 'active',
        notes: fields[10] || ''
      };
    }).filter(link => link.id && link.rawUrl);
  } catch (error) {
    return [];
  }
}

async function saveLinks(links: LinkData[]): Promise<void> {
  const headers = ['id', 'rawUrl', 'shortUrl', 'campaignId', 'userId', 'trackingParams', 'createdAt', 'customAlias', 'tags', 'status', 'notes'];
  const rows = links.map(link => [
    link.id,
    link.rawUrl,
    link.shortUrl,
    link.campaignId,
    link.userId,
    link.trackingParams,
    link.createdAt,
    link.customAlias || '',
    link.tags,
    link.status,
    link.notes
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("links.csv", Buffer.from(csvContent));
}

// Updates an existing affiliate link with new metadata and settings.
export const update = api<UpdateLinkRequest, UpdateLinkResponse>(
  { expose: true, method: "PUT", path: "/links/:linkId" },
  async (req) => {
    const { linkId, userId, customAlias, tags, status, notes } = req;

    if (!linkId || !userId) {
      throw APIError.invalidArgument("Link ID and User ID are required");
    }

    try {
      const links = await loadLinks();
      const linkIndex = links.findIndex(link => link.id === linkId && link.userId === userId);

      if (linkIndex === -1) {
        throw APIError.notFound("Link not found");
      }

      // Update link data
      if (customAlias !== undefined) {
        links[linkIndex].customAlias = customAlias;
      }
      if (tags !== undefined) {
        links[linkIndex].tags = JSON.stringify(tags);
      }
      if (status !== undefined) {
        links[linkIndex].status = status;
      }
      if (notes !== undefined) {
        links[linkIndex].notes = notes;
      }

      await saveLinks(links);

      const updatedLink = links[linkIndex];
      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(updatedLink.tags);
      } catch (error) {
        parsedTags = [];
      }

      return {
        success: true,
        link: {
          id: updatedLink.id,
          rawUrl: updatedLink.rawUrl,
          shortUrl: updatedLink.shortUrl,
          customAlias: updatedLink.customAlias,
          tags: parsedTags,
          status: updatedLink.status,
          notes: updatedLink.notes
        }
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Update link error:", error);
      throw APIError.internal("Failed to update link");
    }
  }
);
