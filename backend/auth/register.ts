import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import bcrypt from "bcrypt";
import { parseCSVLine, createCSVContent } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });

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

async function loadUsers(): Promise<User[]> {
  try {
    const usersData = await dataBucket.download("users.csv");
    const csvContent = usersData.toString();
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length <= 1) {
      console.log("No existing users found");
      return [];
    }
    
    const users = lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        email: fields[1] || '',
        password: fields[2] || '',
        oauthToken: fields[3] || undefined,
        createdAt: fields[4] || ''
      };
    }).filter(user => user.id && user.email);
    
    console.log(`Loaded ${users.length} existing users`);
    return users;
  } catch (error) {
    console.log("Users file doesn't exist yet, starting with empty array");
    return [];
  }
}

async function saveUsers(users: User[]): Promise<void> {
  const headers = ['id', 'email', 'password', 'oauthToken', 'createdAt'];
  const rows = users.map(user => [
    user.id,
    user.email,
    user.password,
    user.oauthToken || '',
    user.createdAt
  ]);
  
  const csvContent = createCSVContent(headers, rows);
  await dataBucket.upload("users.csv", Buffer.from(csvContent));
  console.log(`Saved ${users.length} users to CSV`);
}

// Registers a new user account.
export const register = api<RegisterRequest, RegisterResponse>(
  { expose: true, method: "POST", path: "/auth/register" },
  async (req) => {
    const { email, password } = req;

    if (!email || !password) {
      throw APIError.invalidArgument("Email and password are required");
    }

    if (password.length < 6) {
      throw APIError.invalidArgument("Password must be at least 6 characters long");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw APIError.invalidArgument("Invalid email format");
    }

    try {
      // Load existing users
      const users = await loadUsers();
      console.log(`Registration attempt for: ${email}`);

      // Check if user already exists (case insensitive)
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = users.find(user => user.email.toLowerCase() === normalizedEmail);
      if (existingUser) {
        console.log(`User already exists: ${normalizedEmail}`);
        throw APIError.alreadyExists("An account with this email already exists. Please try logging in instead.");
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user with unique ID
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const newUser: User = {
        id: userId,
        email: normalizedEmail,
        password: hashedPassword,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);

      // Save users
      await saveUsers(users);

      console.log(`User registered successfully: ${normalizedEmail} with ID: ${userId}`);

      return {
        userId,
        email: normalizedEmail,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Registration error:", error);
      throw APIError.internal("Failed to create user account");
    }
  }
);
