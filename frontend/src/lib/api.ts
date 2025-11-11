import axios, { AxiosError, AxiosResponse, CancelToken } from 'axios';
import type { ApiResponse, ApiError } from '@medicine-man/shared';

// Track pending requests to prevent duplicates
const pendingRequests = new Map<string, CancelToken>();

// Create axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token and prevent duplicate requests
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // localStorage may be unavailable in private browsing mode
      console.warn('localStorage unavailable in request interceptor:', error);
    }

    // Prevent duplicate GET requests
    if (config.method?.toUpperCase() === 'GET') {
      const requestKey = `${config.method}:${config.url}`;

      if (pendingRequests.has(requestKey)) {
        // Use existing cancel token for duplicate request
        config.cancelToken = pendingRequests.get(requestKey);
      } else {
        // Create new cancel token for this request
        const CancelToken = axios.CancelToken;
        const cancelToken = new CancelToken((cancel) => {
          // Store the cancel function
        });
        config.cancelToken = cancelToken;
        pendingRequests.set(requestKey, cancelToken);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and clean up pending requests
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // Clean up pending request
    if (response.config.method?.toUpperCase() === 'GET') {
      const requestKey = `${response.config.method}:${response.config.url}`;
      pendingRequests.delete(requestKey);
    }
    return response;
  },
  (error: AxiosError<ApiError>) => {
    // Clean up pending request
    if (error.config?.method?.toUpperCase() === 'GET') {
      const requestKey = `${error.config.method}:${error.config.url}`;
      pendingRequests.delete(requestKey);
    }

    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response?.status === 401) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (storageError) {
        console.warn('localStorage unavailable in response interceptor:', storageError);
      }
      window.location.href = '/login';
    }

    // Return structured error
    const errorMessage = error.response?.data?.message || error.message || 'An error occurred';
    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
    });
  }
);

export default api;

// Helper function to handle API errors
export const handleApiError = (error: any): string => {
  if (error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
};
