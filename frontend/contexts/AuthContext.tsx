import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import backend from '~backend/client';

interface User {
  userId: string;
  email: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('linktracker_token');
    const userData = localStorage.getItem('linktracker_user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser({ ...parsedUser, token });
        console.log('Restored user session:', parsedUser.email);
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('linktracker_token');
        localStorage.removeItem('linktracker_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login for:', email);
      const response = await backend.auth.login({ 
        email: email.trim(), 
        password: password 
      });
      
      const userData = {
        userId: response.userId,
        email: response.email,
        token: response.token,
      };
      
      setUser(userData);
      localStorage.setItem('linktracker_token', response.token);
      localStorage.setItem('linktracker_user', JSON.stringify({
        userId: response.userId,
        email: response.email,
      }));
      
      console.log('Login successful for:', response.email);
    } catch (error: any) {
      console.error('Login failed:', error);
      // Clear any existing auth data on login failure
      localStorage.removeItem('linktracker_token');
      localStorage.removeItem('linktracker_user');
      setUser(null);
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      console.log('Attempting registration for:', email);
      await backend.auth.register({ 
        email: email.trim(), 
        password: password 
      });
      console.log('Registration successful, now logging in...');
      await login(email.trim(), password);
    } catch (error: any) {
      console.error('Registration failed:', error);
      // Clear any existing auth data on registration failure
      localStorage.removeItem('linktracker_token');
      localStorage.removeItem('linktracker_user');
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    console.log('Logging out user:', user?.email);
    setUser(null);
    localStorage.removeItem('linktracker_token');
    localStorage.removeItem('linktracker_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
