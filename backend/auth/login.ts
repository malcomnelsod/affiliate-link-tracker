import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { secret } from "encore.dev/config";

const dataBucket = new Bucket("app-data");
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

// Authenticates a user and returns a JWT token.
export const login = api<LoginRequest, LoginResponse>(
  { expose: true, method: "POST", path: "/auth/login" },
  async (req) => {
    const { email, password } = req;

    // Load users from CSV
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
      throw APIError.unauthenticated("Invalid email or password");
    }

    // Find user
    const user = users.find(u => u.email === email);
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
  }
);
