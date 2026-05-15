import '@testing-library/jest-dom'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LoginPage from '@/app/login/page'
import { signIn } from 'next-auth/react'
import { toast } from '@/hooks/use-toast'

const replaceMock = jest.fn()

let searchParams = new URLSearchParams()

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
  useSearchParams: () => searchParams,
}))

jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
}))

global.fetch = jest.fn()

describe('LoginPage', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    ;(signIn as jest.Mock).mockReset()
    ;(toast as jest.Mock).mockReset()
    ;(fetch as jest.Mock).mockReset()
    searchParams = new URLSearchParams('callbackUrl=%2Fdashboard%2Ffiles&error=unauthorized')
  })

  it('submits the clean callbackUrl and redirects to the successful destination', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success' }),
    })
    ;(signIn as jest.Mock).mockResolvedValue({
      error: undefined,
      ok: true,
      url: '/dashboard/files',
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'avneesh@fitpage.in' },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'Welcome@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /secure sign in/i }))

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'avneesh@fitpage.in',
        password: 'Welcome@123',
        redirect: false,
        callbackUrl: '/dashboard/files',
      })
    })

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard/files')
    })

    expect(toast).not.toHaveBeenCalled()
  })

  it('shows an inline notice with a create-account CTA when the email is not found', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'user-not-found' }),
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'missing@fitpage.in' },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'Welcome@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /secure sign in/i }))

    expect(await screen.findByText(/no account found for this email/i)).toBeInTheDocument()
    expect(screen.getByText(/check the email you entered, or create a new account to get started/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute('href', '/register')
    expect(signIn).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('shows an inline wrong-password notice without a create-account CTA', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'invalid-password' }),
    })

    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'avneesh@fitpage.in' },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'WrongPassword@123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /secure sign in/i }))

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument()
    expect(screen.getByText(/check your password and try again/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /create account/i })).not.toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })

  it('renders unauthorized access using the same inline notice style', () => {
    render(<LoginPage />)

    expect(screen.getByText(/login required/i)).toBeInTheDocument()
    expect(screen.getByText(/please sign in to continue to that page/i)).toBeInTheDocument()
    expect(toast).not.toHaveBeenCalled()
  })
})
