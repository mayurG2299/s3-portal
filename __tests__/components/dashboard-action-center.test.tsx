import '@testing-library/jest-dom'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ActionCenter } from '@/components/dashboard/action-center'
import type { DashboardAction } from '@/lib/dashboard-action-center'

describe('ActionCenter', () => {
  it('renders action rows with severity labels and CTA links', () => {
    const actions: DashboardAction[] = [
      {
        id: 'no-credentials',
        severity: 'critical',
        title: 'Add cloud credentials',
        description: 'Connect your credentials first.',
        href: '/dashboard/settings',
        ctaLabel: 'Configure AWS',
      },
      {
        id: 'healthy',
        severity: 'info',
        title: 'System is ready',
        description: 'Everything is healthy.',
        href: '/dashboard/files',
        ctaLabel: 'Browse files',
      },
    ]

    render(<ActionCenter actions={actions} />)

    expect(screen.getByText('Action Center')).toBeInTheDocument()
    expect(screen.getByText('Add cloud credentials')).toBeInTheDocument()
    expect(screen.getByText('System is ready')).toBeInTheDocument()

    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /configure aws/i })).toHaveAttribute('href', '/dashboard/settings')
    expect(screen.getByRole('link', { name: /browse files/i })).toHaveAttribute('href', '/dashboard/files')
  })
})
