import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { secret } from "encore.dev/config";
import { parseCSVLine } from "../storage/csv-utils";

const dataBucket = new Bucket("app-data", { public: false });
const jwtSecret = secret("JWTSecret");

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
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
      return [];
    }
    
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      return {
        id: fields[0] || '',
        email: fields[1] || '',
        password: fields[2] || '',
        oauthToken: fields[3] || undefined,
        createdAt: fields[4] || ''
      };
    }).filter(user => user.id && user.email);
  } catch (error) {
    console.log("Users file doesn't exist yet");
    return [];
  }
}

// Authenticates a user and returns a JWT token.
export const login = api<LoginRequest, LoginResponse>(
  { expose: true, method: "POST", path: "/auth/login" },
  async (req) => {
    const { email, password } = req;

    if (!email || !password) {
      throw APIError.invalidArgument("Email and password are required");
    }

    try {
      // Load users from CSV
      const users = await loadUsers();
      console.log(`Login attempt for: ${email}, found ${users.length} users in database`);

      // Find user (case insensitive)
      const normalizedEmail = email.toLowerCase().trim();
      const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
      
      if (!user) {
        console.log(`User not found: ${normalizedEmail}`);
        throw APIError.unauthenticated("Invalid email or password");
      }

      console.log(`User found: ${user.email} with ID: ${user.id}`);

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log(`Invalid password for user: ${normalizedEmail}`);
        throw APIError.unauthenticated("Invalid email or password");
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        jwtSecret(),
        { expiresIn: "7d" }
      );

      console.log(`Login successful for user: ${user.email}`);

      return {
        token,
        userId: user.id,
        email: user.email,
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Login error:", error);
      throw APIError.unauthenticated("Invalid email or password");
    }
  }
);
