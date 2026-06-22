import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  apiFetch,
  ApiError,
  restoreSession,
  setAccessToken,
  UNAUTHORIZED_EVENT,
  type SessionInfo,
} from '@/services/api';

export interface User {
  id: number;
  username: string;
  role: 'manager' | 'employee';
  farmId: number;
  farmName: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string, farmName: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBootstrapping: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUser(s: SessionInfo): User {
  return {
    id: s.user_id,
    username: s.username,
    role: s.role,
    farmId: s.farm_id,
    farmName: s.farm_name,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    let active = true;
    restoreSession().then((session) => {
      if (!active) return;
      if (session) setUser(toUser(session));
      setIsBootstrapping(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // A failed refresh (expired/revoked) ends the session.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      setError('Your session has expired. Please sign in again.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const authenticate = async (path: string, body: Record<string, unknown>) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await apiFetch<SessionInfo>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAccessToken(data.access_token);
      setUser(toUser(data));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Authentication failed';
      setError(message);
      setUser(null);
      setAccessToken(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const login = (username: string, password: string) =>
    authenticate('/api/auth/login', { username, password });

  const signup = (username: string, password: string, farmName: string) =>
    authenticate('/api/auth/signup', { username, password, farm_name: farmName });

  const logout = () => {
    void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
        isLoading,
        isBootstrapping,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Colocating the consumer hook with its provider is the standard Context
// pattern; the fast-refresh warning does not apply to a hook export.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
