import React, { createContext, useContext, useEffect, useState } from 'react';
import { z } from 'zod';
import { apiFetch, ApiError, UNAUTHORIZED_EVENT } from '@/services/api';

const UserSchema = z.object({
  id: z.number(),
  username: z.string().min(1),
  role: z.enum(['manager', 'employee']),
  token: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'moometrics_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const result = UserSchema.safeParse(JSON.parse(stored));
      if (!result.success) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return result.data;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });

  // A 401 from any API call (expired/invalid token) ends the session.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
      setError('Your session has expired. Please sign in again.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        access_token: string;
        role: string;
        user_id: number;
        username: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      const newUser: User = {
        id: data.user_id,
        username: data.username,
        role: data.role as 'manager' | 'employee',
        token: data.access_token,
      };

      const result = UserSchema.safeParse(newUser);
      if (!result.success) {
        throw new Error('Unexpected response from server');
      }

      setUser(result.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Login failed';
      setError(message);
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, isAuthenticated: !!user, isLoading, error }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
