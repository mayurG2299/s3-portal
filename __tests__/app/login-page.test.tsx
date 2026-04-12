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

describe('LoginPage', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    ;(signIn as jest.Mock).mockReset()
    ;(toast as jest.Mock).mockReset()
    searchParams = new URLSearchParams('callbackUrl=%2Fdashboard%2Ffiles&error=unauthorized')
  })

  it('submits the clean callbackUrl and redirects to the successful destination', async () => {
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
})
