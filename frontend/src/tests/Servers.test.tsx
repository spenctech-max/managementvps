import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Servers from '../pages/Servers'
import { renderWithProviders, setupAuthenticatedUser } from './helpers'
import {
  mockAxios,
  mockServers,
  mockScanSummary,
  mockShowSuccess,
  createMockAxiosResponse,
  createMockAxiosError,
  resetAllMocks,
} from './mocks'

// Mock the Terminal component to avoid loading issues
vi.mock('../components/Terminal', () => ({
  default: () => <div>Terminal Component</div>,
}))

describe('Servers Page', () => {
  beforeEach(() => {
    resetAllMocks()
    setupAuthenticatedUser()

    // Default mock responses
    mockAxios.get.mockImplementation((url: string) => {
      if (url === '/servers') {
        return Promise.resolve(createMockAxiosResponse(mockServers))
      }
      if (url.includes('/scan-summary')) {
        return Promise.resolve(
          createMockAxiosResponse({ latestScan: mockScanSummary })
        )
      }
      return Promise.resolve(createMockAxiosResponse({}))
    })
  })

  describe('Server List Display', () => {
    it('renders page title and add button', async () => {
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /servers/i })).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /add server/i })).toBeInTheDocument()
    })

    it('displays loading state initially', () => {
      renderWithProviders(<Servers />)

      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
    })

    it('displays list of servers after loading', async () => {
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
        expect(screen.getByText('Database Server')).toBeInTheDocument()
      })

      expect(screen.getByText('192.168.1.100:22')).toBeInTheDocument()
      expect(screen.getByText('192.168.1.101:22')).toBeInTheDocument()
    })

    it('displays server status indicators', async () => {
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Check for online/offline status indicators
      const serverCards = screen.getAllByText(/192\.168\.1\.10/i)
      expect(serverCards).toHaveLength(2)
    })

    it('displays scan summary when available', async () => {
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText(/latest scan/i)).toBeInTheDocument()
      })

      expect(screen.getByText('10')).toBeInTheDocument() // services count
      expect(screen.getByText('5')).toBeInTheDocument() // filesystems count
    })

    it('shows empty state when no servers exist', async () => {
      mockAxios.get.mockResolvedValueOnce(createMockAxiosResponse([]))

      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText(/no servers/i)).toBeInTheDocument()
        expect(
          screen.getByText(/get started by adding a server/i)
        ).toBeInTheDocument()
      })
    })

    it('displays error message on fetch failure', async () => {
      mockAxios.get.mockRejectedValueOnce(
        createMockAxiosError('Failed to load servers')
      )

      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText(/failed to load servers/i)).toBeInTheDocument()
      })
    })
  })

  describe('Add Server', () => {
    it('opens add server modal when clicking add button', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add server/i }))

      expect(screen.getByRole('heading', { name: /add server/i })).toBeInTheDocument()
    })

    it('closes modal when clicking cancel', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add server/i }))
      await user.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /add server/i })
        ).not.toBeInTheDocument()
      })
    })

    it('successfully adds a new server', async () => {
      const user = userEvent.setup()
      const newServer = {
        id: 'server-3',
        name: 'New Test Server',
        ip: '192.168.1.102',
        port: 22,
        username: 'admin',
        auth_type: 'password',
        is_online: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      mockAxios.post.mockResolvedValueOnce(createMockAxiosResponse(newServer))

      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Open modal
      await user.click(screen.getByRole('button', { name: /add server/i }))

      // Fill form
      await user.type(screen.getByLabelText(/server name/i), newServer.name)
      await user.type(screen.getByLabelText(/ip address/i), newServer.ip)
      await user.type(screen.getByLabelText(/username/i), newServer.username)
      await user.type(screen.getByLabelText(/password/i), 'testpassword')

      // Submit
      await user.click(screen.getByRole('button', { name: /add server$/i }))

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith(
          '/servers',
          expect.objectContaining({
            name: newServer.name,
            ip: newServer.ip,
            username: newServer.username,
          })
        )
      })
    })

    it('validates required fields', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add server/i }))

      // Try to submit without filling fields
      const submitButton = screen.getByRole('button', { name: /add server$/i })
      await user.click(submitButton)

      // Fields should be invalid
      expect(screen.getByLabelText(/server name/i)).toBeInvalid()
      expect(screen.getByLabelText(/ip address/i)).toBeInvalid()
    })
  })

  describe('Edit Server', () => {
    it('opens edit modal with pre-filled data', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Find and click edit button for first server
      const editButtons = screen.getAllByRole('button', { name: '' })
      const editButton = editButtons.find((btn) =>
        btn.querySelector('.lucide-edit')
      )
      if (editButton) {
        await user.click(editButton)
      }

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /edit server/i })
        ).toBeInTheDocument()
      })

      // Check pre-filled values
      expect(screen.getByDisplayValue('Production Server 1')).toBeInTheDocument()
      expect(screen.getByDisplayValue('192.168.1.100')).toBeInTheDocument()
    })

    it('successfully updates server', async () => {
      const user = userEvent.setup()
      mockAxios.put.mockResolvedValueOnce(createMockAxiosResponse({}))

      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Open edit modal
      const editButtons = screen.getAllByRole('button', { name: '' })
      const editButton = editButtons.find((btn) =>
        btn.querySelector('.lucide-edit')
      )
      if (editButton) {
        await user.click(editButton)
      }

      // Update name
      const nameInput = screen.getByDisplayValue('Production Server 1')
      await user.clear(nameInput)
      await user.type(nameInput, 'Updated Server Name')

      // Submit
      await user.click(screen.getByRole('button', { name: /update server/i }))

      await waitFor(() => {
        expect(mockAxios.put).toHaveBeenCalled()
      })
    })
  })

  describe('Delete Server', () => {
    it('shows confirmation dialog before deleting', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Find and click delete button
      const deleteButtons = screen.getAllByRole('button', { name: '' })
      const deleteButton = deleteButtons.find((btn) =>
        btn.querySelector('.lucide-trash-2')
      )

      if (deleteButton) {
        await user.click(deleteButton)
      }

      await waitFor(() => {
        expect(screen.getByText(/delete server/i)).toBeInTheDocument()
        expect(
          screen.getByText(/this action cannot be undone/i)
        ).toBeInTheDocument()
      })
    })

    it('deletes server after confirmation', async () => {
      const user = userEvent.setup()
      mockAxios.delete.mockResolvedValueOnce(createMockAxiosResponse({}))

      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: '' })
      const deleteButton = deleteButtons.find((btn) =>
        btn.querySelector('.lucide-trash-2')
      )

      if (deleteButton) {
        await user.click(deleteButton)
      }

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText(/delete server/i)).toBeInTheDocument()
      })

      const confirmButton = screen.getByRole('button', {
        name: /delete server/i,
      })
      await user.click(confirmButton)

      await waitFor(() => {
        expect(mockAxios.delete).toHaveBeenCalledWith('/servers/server-1')
        expect(mockShowSuccess).toHaveBeenCalledWith(
          'Server deleted successfully'
        )
      })
    })

    it('cancels deletion when clicking cancel', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: '' })
      const deleteButton = deleteButtons.find((btn) =>
        btn.querySelector('.lucide-trash-2')
      )

      if (deleteButton) {
        await user.click(deleteButton)
      }

      // Cancel deletion
      await waitFor(() => {
        expect(screen.getByText(/delete server/i)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /cancel/i }))

      expect(mockAxios.delete).not.toHaveBeenCalled()
    })
  })

  describe('Test Connection', () => {
    it('tests server connection', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockResolvedValueOnce(createMockAxiosResponse({}))

      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      // Find and click test button
      const testButtons = screen.getAllByRole('button', { name: '' })
      const testButton = testButtons.find((btn) =>
        btn.querySelector('.lucide-test-tube')
      )

      if (testButton) {
        await user.click(testButton)
      }

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith('/servers/server-1/test')
      })
    })

    it('shows loading state during connection test', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(createMockAxiosResponse({})), 100)
          )
      )

      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      const testButtons = screen.getAllByRole('button', { name: '' })
      const testButton = testButtons.find((btn) =>
        btn.querySelector('.lucide-test-tube')
      )

      if (testButton) {
        await user.click(testButton)

        // Button should be disabled during test
        expect(testButton).toBeDisabled()
      }
    })
  })

  describe('Authentication Type Selection', () => {
    it('switches between password and SSH key authentication', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Servers />)

      await waitFor(() => {
        expect(screen.getByText('Production Server 1')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /add server/i }))

      const authTypeSelect = screen.getByLabelText(/auth type/i)
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()

      // Switch to SSH key
      await user.selectOptions(authTypeSelect, 'key')

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/paste ssh private key/i)).toBeInTheDocument()
      })
    })
  })
})
