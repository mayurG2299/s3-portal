import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { useListNav } from '@/hooks/use-list-nav'

function fireKey(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  })
}

function advanceThrottle() {
  act(() => { jest.advanceTimersByTime(100) })
}

const items = [{ id: '1' }, { id: '2' }, { id: '3' }]

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})
afterEach(() => jest.useRealTimers())

describe('useListNav', () => {
  test('ArrowDown moves focusedIndex from null to 0', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    expect(result.current.focusedIndex).toBeNull()
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(0)
  })

  test('ArrowDown does not go past last item', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(2)
  })

  test('ArrowUp does not go below 0', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    fireKey('ArrowDown')
    fireKey('ArrowUp')
    expect(result.current.focusedIndex).toBe(0)
  })

  test('Escape clears focusedIndex', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    fireKey('ArrowDown')
    fireKey('Escape')
    expect(result.current.focusedIndex).toBeNull()
  })

  test('D calls onDelete with the focused item', () => {
    const onDelete = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onDelete } })
    )
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(0)
    fireKey('d')
    expect(onDelete).toHaveBeenCalledWith(items[0])
  })

  test('C calls onCopy with the focused item', () => {
    const onCopy = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onCopy } })
    )
    fireKey('ArrowDown')
    fireKey('c')
    expect(onCopy).toHaveBeenCalledWith(items[0])
  })

  test('A calls onAccept with the focused item', () => {
    const onAccept = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onAccept } })
    )
    fireKey('ArrowDown')
    fireKey('a')
    expect(onAccept).toHaveBeenCalledWith(items[0])
  })

  test('X calls onDecline with the focused item', () => {
    const onDecline = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onDecline } })
    )
    fireKey('ArrowDown')
    fireKey('x')
    expect(onDecline).toHaveBeenCalledWith(items[0])
  })

  test('R calls onRefresh', () => {
    const onRefresh = jest.fn()
    renderHook(() => useListNav({ items, isModalOpen: false, onRefresh }))
    fireKey('r')
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  test('D does nothing when no item is focused', () => {
    const onDelete = jest.fn()
    renderHook(() => useListNav({ items, isModalOpen: false, keyActions: { onDelete } }))
    fireKey('d')
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('nothing fires when isModalOpen is true', () => {
    const onDelete = jest.fn()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: true, keyActions: { onDelete } })
    )
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBeNull()
    fireKey('d')
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('nothing fires when an input is focused', () => {
    const onDelete = jest.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const { result } = renderHook(() =>
      useListNav({ items, isModalOpen: false, keyActions: { onDelete } })
    )
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBeNull()
    fireKey('d')
    expect(onDelete).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('itemRefs length matches items length', () => {
    const { result } = renderHook(() => useListNav({ items, isModalOpen: false }))
    expect(result.current.itemRefs).toHaveLength(3)
  })

  test('providing onDelete but not onCopy means C silently does nothing', () => {
    const onDelete = jest.fn()
    renderHook(() => useListNav({ items, isModalOpen: false, keyActions: { onDelete } }))
    fireKey('ArrowDown')
    fireKey('c')
    expect(onDelete).not.toHaveBeenCalled()
  })
})
