import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { handleApiError } from '../lib/api';
import type { User, AuthResponse, ApiResponse } from '@medicine-man/shared';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    try {
      console.log('[AuthContext] Initializing auth state...');
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      console.log('[AuthContext] Stored token:', storedToken ? 'exists' : 'none');
      console.log('[AuthContext] Stored user:', storedUser ? 'exists' : 'none');

      if (storedToken && storedUser) {
        console.log('[AuthContext] Restoring session from storage');
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        // Verify token is still valid
        verifyToken(storedToken);
      } else {
        console.log('[AuthContext] No stored session found');
        setLoading(false);
      }
    } catch (error) {
      // localStorage may be unavailable (private browsing, storage full, etc.)
      console.warn('[AuthContext] Error during initialization:', error);
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      console.log('[AuthContext] Verifying token with backend...');
      const response = await api.get<ApiResponse<{ user: User }>>('/auth/me');
      console.log('[AuthContext] Token verified successfully');
      setUser(response.data.data!.user);
    } catch (error) {
      // Token invalid, clear auth state
      console.warn('[AuthContext] Token verification failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        username,
        password,
      });

      const { token, user } = response.data.data;

      // Store in state
      setToken(token);
      setUser(user);

      // Try to store in localStorage, but don't fail if unavailable
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      } catch (storageError) {
        console.warn('localStorage unavailable for storing auth:', storageError);
        // Continue anyway - auth works without localStorage persistence
      }
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (error) {
      console.warn('localStorage unavailable for logout:', error);
      // Continue anyway - session is cleared in memory
    }
  };

  const value = {
    user,
    token,
    login,
    logout,
    loading,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
