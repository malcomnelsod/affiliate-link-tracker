import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import bcrypt from "bcrypt";

const db = new SQLDatabase("users", {
  migrations: "./migrations",
});

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  userId: string;
  email: string;
}

// Registers a new user account.
export const register = api<RegisterRequest, RegisterResponse>(
  { expose: true, method: "POST", path: "/auth/register" },
  async (req) => {
    const { email, password } = req;

    // Check if user already exists
    const existingUser = await db.queryRow`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUser) {
      throw APIError.alreadyExists("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.queryRow<{ id: string }>`
      INSERT INTO users (email, password, created_at)
      VALUES (${email}, ${hashedPassword}, NOW())
      RETURNING id
    `;

    if (!user) {
      throw APIError.internal("Failed to create user");
    }

    return {
      userId: user.id,
      email: email,
    };
  }
);
