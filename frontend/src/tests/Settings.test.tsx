import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '../pages/Settings'
import { renderWithProviders, setupAuthenticatedUser, mockUser } from './helpers'
import {
  mockAxios,
  mock2FAStatus,
  mock2FAStatusEnabled,
  mock2FASetup,
  mockShowSuccess,
  createMockAxiosResponse,
  createMockAxiosError,
  resetAllMocks,
} from './mocks'

describe('Settings Page', () => {
  beforeEach(() => {
    resetAllMocks()
    setupAuthenticatedUser()

    // Default mock responses
    mockAxios.get.mockImplementation((url: string) => {
      if (url === '/auth/2fa/status') {
        return Promise.resolve(createMockAxiosResponse(mock2FAStatus))
      }
      return Promise.resolve(createMockAxiosResponse({}))
    })
  })

  describe('Page Layout', () => {
    it('renders settings page with all sections', async () => {
      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument()
      })

      expect(screen.getByText(/account information/i)).toBeInTheDocument()
      expect(screen.getByText(/profile settings/i)).toBeInTheDocument()
      expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument()
      expect(screen.getByText(/change password/i)).toBeInTheDocument()
    })

    it('displays user information', async () => {
      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText(mockUser.id)).toBeInTheDocument()
      })

      expect(screen.getByText(mockUser.username)).toBeInTheDocument()
      expect(screen.getByDisplayValue(mockUser.email)).toBeInTheDocument()
    })
  })

  describe('Profile Settings', () => {
    it('allows updating username and email', async () => {
      const user = userEvent.setup()
      mockAxios.put.mockResolvedValueOnce(createMockAxiosResponse({}))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockUser.username)).toBeInTheDocument()
      })

      const usernameInput = screen.getByDisplayValue(mockUser.username)
      const emailInput = screen.getByDisplayValue(mockUser.email)

      await user.clear(usernameInput)
      await user.type(usernameInput, 'newusername')

      await user.clear(emailInput)
      await user.type(emailInput, 'newemail@example.com')

      const saveButton = screen.getByRole('button', { name: /save profile/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAxios.put).toHaveBeenCalledWith(
          `/users/${mockUser.id}`,
          expect.objectContaining({
            username: 'newusername',
            email: 'newemail@example.com',
          })
        )
      })

      expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument()
    })

    it('shows error when profile update fails', async () => {
      const user = userEvent.setup()
      mockAxios.put.mockRejectedValueOnce(
        createMockAxiosError('Username already exists')
      )

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockUser.username)).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: /save profile/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(screen.getByText(/username already exists/i)).toBeInTheDocument()
      })
    })
  })

  describe('Password Change', () => {
    it('successfully changes password', async () => {
      const user = userEvent.setup()
      mockAxios.put.mockResolvedValueOnce(createMockAxiosResponse({}))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/current password/i), 'oldpassword')
      await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        'newpassword123'
      )

      await user.click(screen.getByRole('button', { name: /change password/i }))

      await waitFor(() => {
        expect(mockAxios.put).toHaveBeenCalledWith(
          `/users/${mockUser.id}/password`,
          {
            currentPassword: 'oldpassword',
            newPassword: 'newpassword123',
          }
        )
      })

      expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument()
    })

    it('validates password length', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/current password/i), 'old')
      await user.type(screen.getByLabelText(/^new password$/i), 'short')
      await user.type(screen.getByLabelText(/confirm new password/i), 'short')

      await user.click(screen.getByRole('button', { name: /change password/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 8 characters/i)
        ).toBeInTheDocument()
      })

      expect(mockAxios.put).not.toHaveBeenCalled()
    })

    it('validates password confirmation match', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/current password/i), 'oldpassword')
      await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        'differentpassword'
      )

      await user.click(screen.getByRole('button', { name: /change password/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/new passwords do not match/i)
        ).toBeInTheDocument()
      })

      expect(mockAxios.put).not.toHaveBeenCalled()
    })

    it('shows error when current password is incorrect', async () => {
      const user = userEvent.setup()
      mockAxios.put.mockRejectedValueOnce(
        createMockAxiosError('Current password is incorrect')
      )

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText(/current password/i), 'wrongpassword')
      await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
      await user.type(
        screen.getByLabelText(/confirm new password/i),
        'newpassword123'
      )

      await user.click(screen.getByRole('button', { name: /change password/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/current password is incorrect/i)
        ).toBeInTheDocument()
      })
    })

    it('clears password fields after successful change', async () => {
      const user = userEvent.setup()
      mockAxios.put.mockResolvedValueOnce(createMockAxiosResponse({}))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
      })

      const currentPasswordInput = screen.getByLabelText(/current password/i)
      const newPasswordInput = screen.getByLabelText(/^new password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm new password/i)

      await user.type(currentPasswordInput, 'oldpassword')
      await user.type(newPasswordInput, 'newpassword123')
      await user.type(confirmPasswordInput, 'newpassword123')

      await user.click(screen.getByRole('button', { name: /change password/i }))

      await waitFor(() => {
        expect(screen.getByText(/password changed successfully/i)).toBeInTheDocument()
      })

      // Fields should be cleared
      expect(currentPasswordInput).toHaveValue('')
      expect(newPasswordInput).toHaveValue('')
      expect(confirmPasswordInput).toHaveValue('')
    })
  })

  describe('Two-Factor Authentication - Disabled State', () => {
    it('shows enable 2FA button when disabled', async () => {
      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText(/disabled/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
    })

    it('starts 2FA setup process', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockResolvedValueOnce(createMockAxiosResponse(mock2FASetup))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable 2fa/i }))

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith('/auth/2fa/setup')
        expect(screen.getByText(/scan qr code/i)).toBeInTheDocument()
        expect(screen.getByAltText(/2fa qr code/i)).toBeInTheDocument()
      })
    })

    it('displays backup codes during setup', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockResolvedValueOnce(createMockAxiosResponse(mock2FASetup))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable 2fa/i }))

      await waitFor(() => {
        expect(screen.getByText(/save your backup codes/i)).toBeInTheDocument()
      })

      // Check that backup codes are displayed
      mock2FASetup.backupCodes.forEach((code) => {
        expect(screen.getByText(code)).toBeInTheDocument()
      })
    })

    it('completes 2FA enablement with valid token', async () => {
      const user = userEvent.setup()
      mockAxios.post
        .mockResolvedValueOnce(createMockAxiosResponse(mock2FASetup))
        .mockResolvedValueOnce(createMockAxiosResponse({ message: '2FA enabled' }))

      mockAxios.get.mockResolvedValueOnce(
        createMockAxiosResponse(mock2FAStatusEnabled)
      )

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable 2fa/i }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
      })

      // Enter 6-digit code
      await user.type(screen.getByPlaceholderText('000000'), '123456')

      await user.click(screen.getByRole('button', { name: /enable 2fa$/i }))

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith('/auth/2fa/enable', {
          token: '123456',
        })
        expect(screen.getByText(/2fa enabled successfully/i)).toBeInTheDocument()
      })
    })

    it('validates 6-digit token format', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockResolvedValueOnce(createMockAxiosResponse(mock2FASetup))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable 2fa/i }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
      })

      const tokenInput = screen.getByPlaceholderText('000000')

      // Try non-numeric input
      await user.type(tokenInput, 'abcdef')
      expect(tokenInput).toHaveValue('')

      // Try partial code
      await user.type(tokenInput, '123')
      expect(screen.getByRole('button', { name: /enable 2fa$/i })).toBeDisabled()

      // Complete code
      await user.type(tokenInput, '456')
      expect(screen.getByRole('button', { name: /enable 2fa$/i })).toBeEnabled()
    })

    it('allows copying backup codes to clipboard', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockResolvedValueOnce(createMockAxiosResponse(mock2FASetup))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable 2fa/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /enable 2fa/i }))

      await waitFor(() => {
        expect(screen.getByText(/copy all codes/i)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /copy all codes/i }))

      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Copied to clipboard!')
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        mock2FASetup.backupCodes.join('\n')
      )
    })
  })

  describe('Two-Factor Authentication - Enabled State', () => {
    beforeEach(() => {
      mockAxios.get.mockImplementation((url: string) => {
        if (url === '/auth/2fa/status') {
          return Promise.resolve(createMockAxiosResponse(mock2FAStatusEnabled))
        }
        return Promise.resolve(createMockAxiosResponse({}))
      })
    })

    it('shows 2FA as enabled with status', async () => {
      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByText(/enabled/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/8 codes remaining/i)).toBeInTheDocument()
    })

    it('shows warning when backup codes are low', async () => {
      mockAxios.get.mockImplementation((url: string) => {
        if (url === '/auth/2fa/status') {
          return Promise.resolve(
            createMockAxiosResponse({
              ...mock2FAStatusEnabled,
              backupCodesRemaining: 2,
            })
          )
        }
        return Promise.resolve(createMockAxiosResponse({}))
      })

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(
          screen.getByText(/running low on backup codes/i)
        ).toBeInTheDocument()
      })
    })

    it('regenerates backup codes with password confirmation', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockResolvedValueOnce(
        createMockAxiosResponse({ backupCodes: mock2FASetup.backupCodes })
      )

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /regenerate/i }))

      // Confirm regeneration
      await waitFor(() => {
        expect(screen.getByText(/regenerate backup codes/i)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: /regenerate codes/i }))

      // Enter password in prompt
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument()
      })

      await user.type(
        screen.getByPlaceholderText(/enter your password/i),
        'mypassword'
      )
      await user.click(screen.getByRole('button', { name: /confirm/i }))

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith(
          '/auth/2fa/regenerate-backup-codes',
          { password: 'mypassword' }
        )
      })
    })

    it('disables 2FA with password confirmation', async () => {
      const user = userEvent.setup()
      mockAxios.post.mockResolvedValueOnce(createMockAxiosResponse({}))
      mockAxios.get.mockResolvedValueOnce(createMockAxiosResponse(mock2FAStatus))

      renderWithProviders(<Settings />)

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/enter your password/i)
        ).toBeInTheDocument()
      })

      // Fill in password for disable 2FA
      const disablePasswordInput = screen.getByPlaceholderText(/enter your password/i)
      await user.type(disablePasswordInput, 'mypassword')

      await user.click(screen.getByRole('button', { name: /^disable$/i }))

      await waitFor(() => {
        expect(mockAxios.post).toHaveBeenCalledWith('/auth/2fa/disable', {
          password: 'mypassword',
        })
        expect(screen.getByText(/2fa disabled successfully/i)).toBeInTheDocument()
      })
    })
  })
})
