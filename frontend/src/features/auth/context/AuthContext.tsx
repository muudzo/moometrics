import React, { createContext, useContext, useState } from 'react';
import { z } from 'zod';

// Define Zod schema for User
const UserSchema = z.object({
  username: z.string().min(1),
  name: z.string(),
});

type User = z.infer<typeof UserSchema>;

interface AuthContextType {
  user: User | null;
  login: (username: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'moometrics_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [error, setError] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedUser = localStorage.getItem(STORAGE_KEY);
      if (!storedUser) return null;

      const parsed = JSON.parse(storedUser);
      const result = UserSchema.safeParse(parsed);

      if (!result.success) {
        console.warn('Corrupted user data found in localStorage, clearing.', result.error);
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return result.data;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  });

  const login = async (username: string) => {
    setError(null);
    try {
      // Validate input
      if (!username || username.trim() === '') {
        throw new Error('Username cannot be empty');
      }

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const newUser = { username, name: username };

      // Validate the user object before setting state
      const result = UserSchema.safeParse(newUser);
      if (!result.success) {
        throw new Error('Invalid user data generated');
      }

      setUser(result.data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      console.error('Login error:', err);
      // Ensure state is consistent on failure
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, error }}>
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
