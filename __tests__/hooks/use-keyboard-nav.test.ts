import { renderHook, act } from '@testing-library/react'
import { useKeyboardNav } from '@/hooks/use-keyboard-nav'

const makeFile = (id: string, name: string, isDir = false) => ({
  id,
  name,
  key: isDir ? `${name}/` : name,
  contentType: isDir ? 'application/x-directory' : 'text/plain',
})

const files = [
  makeFile('1', 'folder-a', true),
  makeFile('2', 'file-b.txt'),
  makeFile('3', 'file-c.png'),
]

function fireKey(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
  })
}

// Advance fake timers past the 80ms throttle window
function advanceThrottle() {
  act(() => {
    jest.advanceTimersByTime(100)
  })
}

const baseOptions = {
  files,
  isModalOpen: false,
  isPreviewOpen: false,
  onNavigateToFolder: jest.fn(),
  onNavigateUp: jest.fn(),
  onPreview: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useKeyboardNav', () => {
  test('ArrowDown moves focusedIndex from null to 0', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    expect(result.current.focusedIndex).toBeNull()
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(0)
  })

  test('ArrowDown moves focus forward through the list', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown')
    advanceThrottle()
    fireKey('ArrowDown')
    expect(result.current.focusedIndex).toBe(1)
  })

  test('ArrowDown does not go past the last item', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown')
    advanceThrottle()
    fireKey('ArrowDown')
    advanceThrottle()
    fireKey('ArrowDown')
    advanceThrottle()
    fireKey('ArrowDown') // already at last
    expect(result.current.focusedIndex).toBe(2)
  })

  test('ArrowUp does not go below 0', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown') // index 0
    advanceThrottle()
    fireKey('ArrowUp')   // still 0
    expect(result.current.focusedIndex).toBe(0)
  })

  test('ArrowUp from null jumps to last item', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowUp')
    expect(result.current.focusedIndex).toBe(files.length - 1)
  })

  test('Enter on folder calls onNavigateToFolder and resets index', () => {
    const onNavigateToFolder = jest.fn()
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, onNavigateToFolder })
    )
    fireKey('ArrowDown') // focus index 0 = folder-a
    fireKey('Enter')
    expect(onNavigateToFolder).toHaveBeenCalledWith(files[0])
    expect(result.current.focusedIndex).toBeNull()
  })

  test('Enter on a file does nothing', () => {
    const onNavigateToFolder = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateToFolder }))
    fireKey('ArrowDown') // 0 = folder
    advanceThrottle()
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey('Enter')
    expect(onNavigateToFolder).not.toHaveBeenCalled()
  })

  test('Space calls onPreview for a file', () => {
    const onPreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onPreview }))
    fireKey('ArrowDown') // 0 = folder
    advanceThrottle()
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey(' ')
    expect(onPreview).toHaveBeenCalledWith(files[1])
  })

  test('Space on a folder does nothing', () => {
    const onPreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onPreview }))
    fireKey('ArrowDown') // 0 = folder-a
    fireKey(' ')
    expect(onPreview).not.toHaveBeenCalled()
  })

  test('Backspace calls onNavigateUp', () => {
    const onNavigateUp = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateUp }))
    fireKey('Backspace')
    expect(onNavigateUp).toHaveBeenCalled()
  })

  test('no shortcuts fire when isModalOpen is true', () => {
    const onNavigateUp = jest.fn()
    renderHook(() =>
      useKeyboardNav({ ...baseOptions, isModalOpen: true, onNavigateUp })
    )
    fireKey('Backspace')
    expect(onNavigateUp).not.toHaveBeenCalled()
  })

  test('no shortcuts fire when an input is focused', () => {
    const onNavigateUp = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateUp }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireKey('Backspace')
    expect(onNavigateUp).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  test('event.repeat is ignored for Enter', () => {
    const onNavigateToFolder = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateToFolder }))
    fireKey('ArrowDown') // focus folder
    fireKey('Enter', { repeat: true })
    expect(onNavigateToFolder).not.toHaveBeenCalled()
  })

  test('itemRefs length matches files length', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    expect(result.current.itemRefs).toHaveLength(files.length)
  })

  test('event.repeat is ignored for Space', () => {
    const onPreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onPreview }))
    fireKey('ArrowDown')
    advanceThrottle()
    fireKey('ArrowDown') // index 1 = file-b.txt
    fireKey(' ', { repeat: true })
    expect(onPreview).not.toHaveBeenCalled()
  })

  test('event.repeat is ignored for Backspace', () => {
    const onNavigateUp = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateUp }))
    fireKey('Backspace', { repeat: true })
    expect(onNavigateUp).not.toHaveBeenCalled()
  })

  test('focusedIndex resets to null when files array changes', () => {
    const newFiles = [makeFile('4', 'new-file.txt')]
    const { result, rerender } = renderHook(
      ({ files }: { files: ReturnType<typeof makeFile>[] }) =>
        useKeyboardNav({ ...baseOptions, files }),
      { initialProps: { files } }
    )
    fireKey('ArrowDown') // focus index 0
    expect(result.current.focusedIndex).toBe(0)
    rerender({ files: newFiles })
    expect(result.current.focusedIndex).toBeNull()
  })

  test('Enter with no focused item does nothing', () => {
    const onNavigateToFolder = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateToFolder }))
    // do not fire ArrowDown first — focusedIndex is null
    fireKey('Enter')
    expect(onNavigateToFolder).not.toHaveBeenCalled()
  })

  test('Escape clears focusedIndex', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('ArrowDown') // index 0
    expect(result.current.focusedIndex).toBe(0)
    fireKey('Escape')
    expect(result.current.focusedIndex).toBeNull()
  })

  test('Escape calls onClosePreview when preview is open', () => {
    const onClosePreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isPreviewOpen: true, onClosePreview }))
    fireKey('Escape')
    expect(onClosePreview).toHaveBeenCalled()
  })

  test('Escape does not call onClosePreview when preview is closed', () => {
    const onClosePreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isPreviewOpen: false, onClosePreview }))
    fireKey('ArrowDown')
    fireKey('Escape')
    expect(onClosePreview).not.toHaveBeenCalled()
  })

  test('Cmd+ArrowUp calls onNavigateUp', () => {
    const onNavigateUp = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNavigateUp }))
    fireKey('ArrowUp', { metaKey: true })
    expect(onNavigateUp).toHaveBeenCalled()
  })

  test('Cmd+ArrowDown on folder calls onNavigateToFolder', () => {
    const onNavigateToFolder = jest.fn()
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, onNavigateToFolder })
    )
    fireKey('ArrowDown') // focus index 0 = folder-a
    fireKey('ArrowDown', { metaKey: true })
    expect(onNavigateToFolder).toHaveBeenCalledWith(files[0])
    expect(result.current.focusedIndex).toBeNull()
  })

  test('Cmd+ArrowDown on file calls onPreview', () => {
    const onPreview = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onPreview }))
    fireKey('ArrowDown') // 0 = folder
    advanceThrottle()
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey('ArrowDown', { metaKey: true })
    expect(onPreview).toHaveBeenCalledWith(files[1])
  })
})
