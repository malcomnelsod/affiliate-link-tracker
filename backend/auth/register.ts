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

// Registers a new user account.
export const register = api<RegisterRequest, RegisterResponse>(
  { expose: true, method: "POST", path: "/auth/register" },
  async (req) => {
    const { email, password } = req;

    // Load existing users
    let users: User[] = [];
    try {
      const usersData = await dataBucket.download("users.csv");
      const csvContent = usersData.toString();
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length > 1) { // Skip header
        users = lines.slice(1).map(line => {
          const [id, userEmail, userPassword, oauthToken, createdAt] = line.split(',');
          return {
            id,
            email: userEmail,
            password: userPassword,
            oauthToken: oauthToken || undefined,
            createdAt
          };
        });
      }
    } catch (error) {
      // File doesn't exist yet, start with empty array
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
      `${user.id},${user.email},${user.password},${user.oauthToken || ''},${user.createdAt}`
    ).join('\n');
    const csvContent = csvHeader + csvRows;

    await dataBucket.upload("users.csv", Buffer.from(csvContent));

    return {
      userId,
      email,
    };
  }
);
