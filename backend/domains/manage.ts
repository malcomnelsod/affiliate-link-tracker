import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

export interface CreateDomainRequest {
  userId: string;
  domain: string;
  isDefault?: boolean;
  sslEnabled?: boolean;
}

export interface Domain {
  id: string;
  userId: string;
  domain: string;
  isDefault: boolean;
  sslEnabled: boolean;
  status: 'pending' | 'active' | 'failed';
  createdAt: Date;
  verificationCode: string;
}

export interface ListDomainsRequest {
  userId: string;
}

export interface ListDomainsResponse {
  domains: Domain[];
}

interface DomainData {
  id: string;
  userId: string;
  domain: string;
  isDefault: string;
  sslEnabled: string;
  status: string;
  createdAt: string;
  verificationCode: string;
}

async function loadDomains(): Promise<DomainData[]> {
  try {
    const domainsData = await dataBucket.download("domains.csv");
    const csvContent = domainsData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        userId: fields[1] || '',
        domain: fields[2] || '',
        isDefault: fields[3] || 'false',
        sslEnabled: fields[4] || 'true',
        status: fields[5] || 'pending',
        createdAt: fields[6] || '',
        verificationCode: fields[7] || ''
      };
    }).filter(domain => domain.id && domain.domain);
  } catch (error) {
    return [];
  }
}

async function saveDomains(domains: DomainData[]): Promise<void> {
  const headers = ['id', 'userId', 'domain', 'isDefault', 'sslEnabled', 'status', 'createdAt', 'verificationCode'];
  const rows = domains.map(domain => [
    domain.id,
    domain.userId,
    domain.domain,
    domain.isDefault,
    domain.sslEnabled,
    domain.status,
    domain.createdAt,
    domain.verificationCode
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("domains.csv", Buffer.from(csvContent));
}

function generateVerificationCode(): string {
  return `linktracker-verify-${Math.random().toString(36).substring(2, 15)}`;
}

function validateDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
  return domainRegex.test(domain);
}

// Adds a custom domain for link redirection.
export const createDomain = api<CreateDomainRequest, Domain>(
  { expose: true, method: "POST", path: "/domains" },
  async (req) => {
    const { userId, domain, isDefault = false, sslEnabled = true } = req;

    if (!validateDomain(domain)) {
      throw APIError.invalidArgument("Invalid domain format");
    }

    try {
      const domains = await loadDomains();
      
      // Check if domain already exists
      const existingDomain = domains.find(d => d.domain === domain);
      if (existingDomain) {
        throw APIError.alreadyExists("Domain already exists");
      }

      // If this is set as default, unset other defaults for this user
      if (isDefault) {
        domains.forEach(d => {
          if (d.userId === userId) {
            d.isDefault = 'false';
          }
        });
      }

      const domainId = `domain_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const verificationCode = generateVerificationCode();
      const createdAt = new Date().toISOString();

      const newDomain: DomainData = {
        id: domainId,
        userId,
        domain,
        isDefault: isDefault.toString(),
        sslEnabled: sslEnabled.toString(),
        status: 'pending',
        createdAt,
        verificationCode
      };

      domains.push(newDomain);
      await saveDomains(domains);

      return {
        id: domainId,
        userId,
        domain,
        isDefault,
        sslEnabled,
        status: 'pending',
        createdAt: new Date(createdAt),
        verificationCode
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Create domain error:", error);
      throw APIError.internal("Failed to create domain");
    }
  }
);

// Lists all custom domains for a user.
export const listDomains = api<ListDomainsRequest, ListDomainsResponse>(
  { expose: true, method: "GET", path: "/domains" },
  async (req) => {
    const { userId } = req;

    try {
      const domains = await loadDomains();
      const userDomains = domains
        .filter(domain => domain.userId === userId)
        .map(domain => ({
          id: domain.id,
          userId: domain.userId,
          domain: domain.domain,
          isDefault: domain.isDefault === 'true',
          sslEnabled: domain.sslEnabled === 'true',
          status: domain.status as 'pending' | 'active' | 'failed',
          createdAt: new Date(domain.createdAt),
          verificationCode: domain.verificationCode
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { domains: userDomains };
    } catch (error) {
      console.error("List domains error:", error);
      return { domains: [] };
    }
  }
);

// Verifies domain ownership and activates the domain.
export const verifyDomain = api<{ domainId: string; userId: string }, { success: boolean; status: string }>(
  { expose: true, method: "POST", path: "/domains/:domainId/verify" },
  async (req) => {
    const { domainId, userId } = req;

    try {
      const domains = await loadDomains();
      const domainIndex = domains.findIndex(d => d.id === domainId && d.userId === userId);

      if (domainIndex === -1) {
        throw APIError.notFound("Domain not found");
      }

      const domain = domains[domainIndex];

      // Simulate DNS verification (in real implementation, check TXT record)
      try {
        // Check if verification code exists in DNS TXT record
        // For demo purposes, we'll mark it as active
        domains[domainIndex].status = 'active';
        await saveDomains(domains);

        return { success: true, status: 'active' };
      } catch (error) {
        domains[domainIndex].status = 'failed';
        await saveDomains(domains);
        return { success: false, status: 'failed' };
      }
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Verify domain error:", error);
      throw APIError.internal("Failed to verify domain");
    }
  }
);
