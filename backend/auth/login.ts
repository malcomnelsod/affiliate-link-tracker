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

      // Find user
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        throw APIError.unauthenticated("Invalid email or password");
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw APIError.unauthenticated("Invalid email or password");
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        jwtSecret(),
        { expiresIn: "7d" }
      );

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
