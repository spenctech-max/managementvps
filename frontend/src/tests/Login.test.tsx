import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from '../pages/Login'
import { renderWithProviders } from './helpers'
import {
  mockAxios,
  mockNavigate,
  mockLoginResponse,
  createMockAxiosError,
  resetAllMocks,
} from './mocks'

describe('Login Component', () => {
  beforeEach(() => {
    resetAllMocks()
    localStorage.clear()
  })

  it('renders login form with all elements', () => {
    renderWithProviders(<Login />)

    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText(/forgot your password/i)).toBeInTheDocument()
  })

  it('displays validation errors for empty fields', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Login />)

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)

    // HTML5 validation should prevent submission
    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)

    expect(usernameInput).toBeInvalid()
    expect(passwordInput).toBeInvalid()
  })

  it('handles successful login', async () => {
    const user = userEvent.setup()
    mockAxios.post.mockResolvedValueOnce({ data: mockLoginResponse })

    renderWithProviders(<Login />)

    // Fill in form
    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/password/i), 'password123')

    // Submit form
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Verify API call
    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/login', {
        username: 'admin',
        password: 'password123',
      })
    })

    // Verify navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })

    // Verify token stored
    expect(localStorage.getItem('token')).toBe(mockLoginResponse.data.token)
    expect(localStorage.getItem('user')).toBe(
      JSON.stringify(mockLoginResponse.data.user)
    )
  })

  it('displays error message on login failure', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Invalid credentials'
    mockAxios.post.mockRejectedValueOnce(createMockAxiosError(errorMessage))

    renderWithProviders(<Login />)

    // Fill in form
    await user.type(screen.getByLabelText(/username/i), 'wronguser')
    await user.type(screen.getByLabelText(/password/i), 'wrongpass')

    // Submit form
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Verify error is displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    // Verify no navigation occurred
    expect(mockNavigate).not.toHaveBeenCalled()

    // Verify no token stored
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('shows loading state during login', async () => {
    const user = userEvent.setup()
    mockAxios.post.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: mockLoginResponse }), 100)
        )
    )

    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/password/i), 'password123')

    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)

    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    })

    // Button should be disabled during loading
    expect(submitButton).toBeDisabled()

    // Wait for completion
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('handles network errors gracefully', async () => {
    const user = userEvent.setup()
    mockAxios.post.mockRejectedValueOnce(
      createMockAxiosError('Network error', 500)
    )

    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  it('clears error message when user starts typing', async () => {
    const user = userEvent.setup()
    mockAxios.post.mockRejectedValueOnce(
      createMockAxiosError('Invalid credentials')
    )

    renderWithProviders(<Login />)

    // Trigger error
    await user.type(screen.getByLabelText(/username/i), 'wrong')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })

    // Start typing again - error should clear on form submit
    mockAxios.post.mockResolvedValueOnce({ data: mockLoginResponse })
    await user.clear(screen.getByLabelText(/username/i))
    await user.type(screen.getByLabelText(/username/i), 'correct')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument()
    })
  })

  it('has link to password reset', () => {
    renderWithProviders(<Login />)

    const resetLink = screen.getByRole('link', { name: /reset here/i })
    expect(resetLink).toBeInTheDocument()
    expect(resetLink).toHaveAttribute('href', '/reset-password')
  })

  it('validates input fields have correct attributes', () => {
    renderWithProviders(<Login />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)

    expect(usernameInput).toHaveAttribute('type', 'text')
    expect(usernameInput).toHaveAttribute('autocomplete', 'username')
    expect(usernameInput).toBeRequired()

    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    expect(passwordInput).toBeRequired()
  })

  it('handles login with special characters in credentials', async () => {
    const user = userEvent.setup()
    mockAxios.post.mockResolvedValueOnce({ data: mockLoginResponse })

    renderWithProviders(<Login />)

    const specialUsername = 'user@domain.com'
    const specialPassword = 'P@ssw0rd!#$%'

    await user.type(screen.getByLabelText(/username/i), specialUsername)
    await user.type(screen.getByLabelText(/password/i), specialPassword)
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/login', {
        username: specialUsername,
        password: specialPassword,
      })
    })
  })

  it('prevents multiple simultaneous login attempts', async () => {
    const user = userEvent.setup()
    mockAxios.post.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: mockLoginResponse }), 100)
        )
    )

    renderWithProviders(<Login />)

    await user.type(screen.getByLabelText(/username/i), 'admin')
    await user.type(screen.getByLabelText(/password/i), 'password123')

    const submitButton = screen.getByRole('button', { name: /sign in/i })

    // Click multiple times
    await user.click(submitButton)
    await user.click(submitButton)
    await user.click(submitButton)

    // Should only be called once
    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledTimes(1)
    })
  })
})
