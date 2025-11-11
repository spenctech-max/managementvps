import { vi } from 'vitest'
import { AxiosResponse } from 'axios'
import type { User, Server, ApiResponse } from '@medicine-man/shared'

// Mock axios
export const mockAxios = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  create: vi.fn(() => mockAxios),
  interceptors: {
    request: {
      use: vi.fn(),
      eject: vi.fn(),
    },
    response: {
      use: vi.fn(),
      eject: vi.fn(),
    },
  },
}

// Mock API module
vi.mock('../lib/api', () => ({
  default: mockAxios,
  handleApiError: (error: any) => {
    if (error.message) return error.message
    if (typeof error === 'string') return error
    return 'An unexpected error occurred'
  },
}))

// Mock toast module
export const mockShowSuccess = vi.fn()
export const mockShowError = vi.fn()
export const mockShowInfo = vi.fn()

vi.mock('../lib/toast', () => ({
  showSuccess: mockShowSuccess,
  showError: mockShowError,
  showInfo: mockShowInfo,
}))

// Mock react-router-dom
export const mockNavigate = vi.fn()
export const mockUseNavigate = vi.fn(() => mockNavigate)

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  }
})

// Mock data generators
export function createMockAxiosResponse<T>(
  data: T,
  status = 200
): AxiosResponse<ApiResponse<T>> {
  return {
    data: {
      success: true,
      message: 'Success',
      data,
    },
    status,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  }
}

export function createMockAxiosError(message: string, status = 400) {
  return {
    message,
    response: {
      status,
      data: {
        success: false,
        message,
      },
    },
  }
}

// Mock user data
export const mockUsers: User[] = [
  {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    is_active: true,
    role: 'admin',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    username: 'testuser',
    email: 'test@example.com',
    is_active: true,
    role: 'user',
    created_at: '2024-01-02T00:00:00Z',
  },
]

// Mock server data
export const mockServers: Server[] = [
  {
    id: 'server-1',
    name: 'Production Server 1',
    ip: '192.168.1.100',
    port: 22,
    username: 'root',
    auth_type: 'password',
    tags: 'production,web',
    description: 'Main production web server',
    is_online: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'server-2',
    name: 'Database Server',
    ip: '192.168.1.101',
    port: 22,
    username: 'admin',
    auth_type: 'key',
    tags: 'production,database',
    description: 'PostgreSQL database server',
    is_online: false,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
]

// Mock login response
export const mockLoginResponse = {
  success: true,
  message: 'Login successful',
  data: {
    token: 'mock-jwt-token-12345',
    user: mockUsers[0],
  },
}

// Mock 2FA status
export const mock2FAStatus = {
  enabled: false,
  enabledAt: null,
  backupCodesRemaining: 0,
}

export const mock2FAStatusEnabled = {
  enabled: true,
  enabledAt: '2024-01-01T00:00:00Z',
  backupCodesRemaining: 8,
}

// Mock 2FA setup
export const mock2FASetup = {
  secret: 'JBSWY3DPEHPK3PXP',
  qrCodeUrl: 'data:image/png;base64,mock-qr-code',
  backupCodes: [
    'AAAA-BBBB-CCCC-1111',
    'DDDD-EEEE-FFFF-2222',
    'GGGG-HHHH-IIII-3333',
    'JJJJ-KKKK-LLLL-4444',
    'MMMM-NNNN-OOOO-5555',
    'PPPP-QQQQ-RRRR-6666',
    'SSSS-TTTT-UUUU-7777',
    'VVVV-WWWW-XXXX-8888',
  ],
}

// Mock scan summary
export const mockScanSummary = {
  id: 'scan-1',
  scan_type: 'full',
  status: 'completed',
  started_at: '2024-01-01T00:00:00Z',
  completed_at: '2024-01-01T00:05:00Z',
  scan_duration: 300,
  summary: {
    services_count: 10,
    critical_services: 2,
    filesystems_count: 5,
    total_estimated_size: 1024000000,
    recommendations_count: 3,
    critical_recommendations: 1,
  },
  error_message: null,
}

// Helper to reset all mocks
export function resetAllMocks() {
  vi.clearAllMocks()
  mockAxios.get.mockReset()
  mockAxios.post.mockReset()
  mockAxios.put.mockReset()
  mockAxios.delete.mockReset()
  mockAxios.patch.mockReset()
  mockNavigate.mockReset()
  mockShowSuccess.mockReset()
  mockShowError.mockReset()
  mockShowInfo.mockReset()
}

// Setup common mock responses
export function setupMockApiResponses() {
  // Default successful responses
  mockAxios.get.mockImplementation((url: string) => {
    if (url === '/auth/me') {
      return Promise.resolve(createMockAxiosResponse({ user: mockUsers[0] }))
    }
    if (url === '/servers') {
      return Promise.resolve(createMockAxiosResponse(mockServers))
    }
    if (url === '/auth/2fa/status') {
      return Promise.resolve(createMockAxiosResponse(mock2FAStatus))
    }
    if (url.includes('/scan-summary')) {
      return Promise.resolve(
        createMockAxiosResponse({ latestScan: mockScanSummary })
      )
    }
    return Promise.resolve(createMockAxiosResponse({}))
  })

  mockAxios.post.mockImplementation((url: string) => {
    if (url === '/auth/login') {
      return Promise.resolve({ data: mockLoginResponse })
    }
    if (url === '/auth/2fa/setup') {
      return Promise.resolve(createMockAxiosResponse(mock2FASetup))
    }
    if (url === '/auth/2fa/enable') {
      return Promise.resolve(
        createMockAxiosResponse({ message: '2FA enabled' })
      )
    }
    if (url === '/servers') {
      return Promise.resolve(createMockAxiosResponse(mockServers[0]))
    }
    return Promise.resolve(createMockAxiosResponse({}))
  })

  mockAxios.put.mockResolvedValue(createMockAxiosResponse({}))
  mockAxios.delete.mockResolvedValue(createMockAxiosResponse({}))
}

// Export test utilities
export const testUtils = {
  resetAllMocks,
  setupMockApiResponses,
  createMockAxiosResponse,
  createMockAxiosError,
}
