import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

function fireKey(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  })
}

const baseOptions = {
  onOpenSearch: jest.fn(),
  onOpenShortcuts: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('useGlobalShortcuts', () => {
  test('Cmd+K is handled by AiSearchPalette — useGlobalShortcuts does NOT call onOpenSearch', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('k', { metaKey: true })
    expect(baseOptions.onOpenSearch).not.toHaveBeenCalled()
  })

  test('Cmd+K with input focused — still does NOT call onOpenSearch', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('k', { metaKey: true })
    expect(baseOptions.onOpenSearch).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('? calls onOpenShortcuts', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('?')
    expect(baseOptions.onOpenShortcuts).toHaveBeenCalledTimes(1)
  })

  test('? does NOT fire when an input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('?')
    expect(baseOptions.onOpenShortcuts).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('Cmd+Shift+2 navigates to /dashboard/files', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('2', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/files')
  })

  test('Cmd+Shift+1 navigates to /dashboard', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('1', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  test('Cmd+Shift+3 navigates to /dashboard/links', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('3', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/links')
  })

  test('Cmd+Shift+7 navigates to /dashboard/admin/permissions', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('7', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/admin/permissions')
  })

  test('Cmd+Shift+8 navigates to /dashboard/admin/audit', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('8', { metaKey: true, shiftKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/admin/audit')
  })

  test('Cmd+Shift+2 does NOT fire when an input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey('2', { metaKey: true, shiftKey: true })
    expect(mockPush).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('Cmd+, navigates to /dashboard/settings', () => {
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey(',', { metaKey: true })
    expect(mockPush).toHaveBeenCalledWith('/dashboard/settings')
  })

  test('Cmd+, does NOT fire when an input is focused', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    renderHook(() => useGlobalShortcuts(baseOptions))
    fireKey(',', { metaKey: true })
    expect(mockPush).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('listener is removed on unmount', () => {
    const spy = jest.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useGlobalShortcuts(baseOptions))
    unmount()
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
    spy.mockRestore()
  })
})
