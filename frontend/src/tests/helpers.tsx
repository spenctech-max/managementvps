import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { vi } from 'vitest'

// Mock router for testing
export function MockRouter({ children }: { children: React.ReactNode }) {
  return <BrowserRouter>{children}</BrowserRouter>
}

// Wrapper with AuthProvider
interface AllProvidersProps {
  children: React.ReactNode
}

export function AllProviders({ children }: AllProvidersProps) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  )
}

// Custom render function with all providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

// Custom render with just router
export function renderWithRouter(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: MockRouter, ...options })
}

// Mock authenticated user
export const mockUser = {
  id: 'test-user-id',
  username: 'testuser',
  email: 'test@example.com',
  is_active: true,
  role: 'admin' as const,
  created_at: '2024-01-01T00:00:00Z',
}

// Mock token
export const mockToken = 'mock-jwt-token'

// Setup authenticated state
export function setupAuthenticatedUser() {
  localStorage.setItem('token', mockToken)
  localStorage.setItem('user', JSON.stringify(mockUser))
}

// Clear authenticated state
export function clearAuthenticatedUser() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

// Mock API response helpers
export function createMockApiResponse<T>(data: T, message = 'Success') {
  return {
    success: true,
    message,
    data,
  }
}

export function createMockApiError(message = 'Error occurred') {
  return {
    success: false,
    message,
  }
}

// Wait for async updates
export function waitForAsync() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// Mock console methods
export function mockConsoleError() {
  const originalError = console.error
  console.error = vi.fn()
  return () => {
    console.error = originalError
  }
}

export function mockConsoleWarn() {
  const originalWarn = console.warn
  console.warn = vi.fn()
  return () => {
    console.warn = originalWarn
  }
}

// Create mock server data
export function createMockServer(overrides = {}) {
  return {
    id: 'server-1',
    name: 'Test Server',
    ip: '192.168.1.100',
    port: 22,
    username: 'root',
    auth_type: 'password' as const,
    tags: 'production',
    description: 'Test server description',
    is_online: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// Create mock scan data
export function createMockScan(overrides = {}) {
  return {
    id: 'scan-1',
    server_id: 'server-1',
    scan_type: 'full' as const,
    status: 'completed' as const,
    started_at: '2024-01-01T00:00:00Z',
    completed_at: '2024-01-01T00:05:00Z',
    scan_duration: 300,
    summary: {
      services_count: 10,
      filesystems_count: 5,
      recommendations_count: 3,
    },
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// Simulate network delay
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Mock toast notifications
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
}

// Spy on navigation
export function createMockNavigate() {
  return vi.fn()
}

// Test IDs for common elements
export const testIds = {
  loginForm: 'login-form',
  usernameInput: 'username-input',
  passwordInput: 'password-input',
  submitButton: 'submit-button',
  errorMessage: 'error-message',
  successMessage: 'success-message',
  loadingSpinner: 'loading-spinner',
  serverCard: 'server-card',
  serverList: 'server-list',
  addServerButton: 'add-server-button',
  deleteButton: 'delete-button',
  confirmDialog: 'confirm-dialog',
}

// Export everything for convenience
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
