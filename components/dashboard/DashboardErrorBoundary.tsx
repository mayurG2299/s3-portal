"use client"

import React from "react"

interface DashboardErrorBoundaryProps {
  children: React.ReactNode
}

interface DashboardErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class DashboardErrorBoundary extends React.Component<DashboardErrorBoundaryProps, DashboardErrorBoundaryState> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Optionally log error
    // console.error('DashboardErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#b91c1c' }}>Dashboard Error</h1>
          <p style={{ marginTop: 16 }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
        </div>
      )
    }
    return this.props.children
  }
}
