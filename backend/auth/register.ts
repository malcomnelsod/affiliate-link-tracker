import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import bcrypt from "bcrypt";

const dataBucket = new Bucket("app-data");

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  userId: string;
  email: string;
}

interface User {
  id: string;
  email: string;
  password: string;
  oauthToken?: string;
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

// Registers a new user account.
export const register = api<RegisterRequest, RegisterResponse>(
  { expose: true, method: "POST", path: "/auth/register" },
  async (req) => {
    const { email, password } = req;

    if (!email || !password) {
      throw APIError.invalidArgument("Email and password are required");
    }

    // Load existing users
    let users: User[] = [];
    try {
      const usersData = await dataBucket.download("users.csv");
      const csvContent = usersData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        users = lines.slice(1).map(line => {
          const fields = parseCSVLine(line);
          return {
            id: fields[0] || '',
            email: fields[1] || '',
            password: fields[2] || '',
            oauthToken: fields[3] || undefined,
            createdAt: fields[4] || ''
          };
        }).filter(user => user.id && user.email); // Filter out invalid entries
      }
    } catch (error) {
      // File doesn't exist yet, start with empty array
      console.log("Users file doesn't exist yet, creating new one");
    }

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      throw APIError.alreadyExists("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const userId = Date.now().toString();
    const newUser: User = {
      id: userId,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    // Save users back to CSV
    const csvHeader = "id,email,password,oauthToken,createdAt\n";
    const csvRows = users.map(user => 
      `${escapeCSVField(user.id)},${escapeCSVField(user.email)},${escapeCSVField(user.password)},${escapeCSVField(user.oauthToken || '')},${escapeCSVField(user.createdAt)}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    try {
      await dataBucket.upload("users.csv", Buffer.from(csvContent));
    } catch (error) {
      console.error("Failed to save user data:", error);
      throw APIError.internal("Failed to create user account");
    }

    return {
      userId,
      email,
    };
  }
);
