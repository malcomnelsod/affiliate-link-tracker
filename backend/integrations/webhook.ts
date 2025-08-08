import { api } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface WebhookRequest {
  userId: string;
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
}

export interface WebhookResponse {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
}

export interface TriggerWebhookRequest {
  event: string;
  data: Record<string, any>;
  userId?: string;
}

interface WebhookData {
  id: string;
  userId: string;
  url: string;
  events: string;
  secret: string;
  active: string;
  createdAt: string;
}

async function loadWebhooks(): Promise<WebhookData[]> {
  try {
    const webhooksData = await dataBucket.download("webhooks.csv");
    const csvContent = webhooksData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        userId: fields[1] || '',
        url: fields[2] || '',
        events: fields[3] || '[]',
        secret: fields[4] || '',
        active: fields[5] || 'true',
        createdAt: fields[6] || ''
      };
    }).filter(webhook => webhook.id && webhook.url);
  } catch (error) {
    return [];
  }
}

async function saveWebhooks(webhooks: WebhookData[]): Promise<void> {
  const headers = ['id', 'userId', 'url', 'events', 'secret', 'active', 'createdAt'];
  const rows = webhooks.map(webhook => [
    webhook.id,
    webhook.userId,
    webhook.url,
    webhook.events,
    webhook.secret,
    webhook.active,
    webhook.createdAt
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("webhooks.csv", Buffer.from(csvContent));
}

// Creates a webhook endpoint for real-time event notifications.
export const createWebhook = api<WebhookRequest, WebhookResponse>(
  { expose: true, method: "POST", path: "/integrations/webhooks" },
  async (req) => {
    const { userId, url, events, secret, active = true } = req;

    try {
      // Validate URL
      new URL(url);

      const webhooks = await loadWebhooks();

      const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const webhookSecret = secret || Math.random().toString(36).substring(2, 15);
      const createdAt = new Date().toISOString();

      const newWebhook: WebhookData = {
        id: webhookId,
        userId,
        url,
        events: JSON.stringify(events),
        secret: webhookSecret,
        active: active.toString(),
        createdAt
      };

      webhooks.push(newWebhook);
      await saveWebhooks(webhooks);

      return {
        id: webhookId,
        url,
        events,
        secret: webhookSecret,
        active,
        createdAt: new Date(createdAt)
      };
    } catch (error) {
      console.error("Create webhook error:", error);
      throw new Error("Failed to create webhook");
    }
  }
);

// Triggers webhooks for specific events.
export const triggerWebhook = api<TriggerWebhookRequest, { success: boolean }>(
  { expose: true, method: "POST", path: "/integrations/webhooks/trigger" },
  async (req) => {
    const { event, data, userId } = req;

    try {
      const webhooks = await loadWebhooks();
      
      // Filter webhooks by user and event
      const relevantWebhooks = webhooks.filter(webhook => {
        if (userId && webhook.userId !== userId) return false;
        if (webhook.active !== 'true') return false;
        
        let events: string[] = [];
        try {
          events = JSON.parse(webhook.events);
        } catch (error) {
          return false;
        }
        
        return events.includes(event) || events.includes('*');
      });

      // Send webhook notifications
      const promises = relevantWebhooks.map(async (webhook) => {
        try {
          const payload = {
            event,
            data,
            timestamp: new Date().toISOString(),
            webhook_id: webhook.id
          };

          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': webhook.secret,
              'User-Agent': 'LinkTracker-Webhook/1.0'
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            console.error(`Webhook ${webhook.id} failed:`, response.status, response.statusText);
          }
        } catch (error) {
          console.error(`Webhook ${webhook.id} error:`, error);
        }
      });

      await Promise.allSettled(promises);

      return { success: true };
    } catch (error) {
      console.error("Trigger webhook error:", error);
      return { success: false };
    }
  }
);
