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

  test('Escape does nothing when a modal is open', () => {
    const onClosePreview = jest.fn()
    renderHook(() =>
      useKeyboardNav({ ...baseOptions, isModalOpen: true, onClosePreview })
    )
    fireKey('Escape')
    expect(onClosePreview).not.toHaveBeenCalled()
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

  test('Delete calls onDelete with focused file', () => {
    const onDelete = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onDelete }))
    fireKey('ArrowDown') // 0 = folder-a
    advanceThrottle()
    fireKey('ArrowDown') // 1 = file-b.txt
    fireKey('Delete')
    expect(onDelete).toHaveBeenCalledWith(files[1])
  })

  test('Delete does nothing when no file is focused', () => {
    const onDelete = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onDelete }))
    fireKey('Delete')
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('Delete works on folders too', () => {
    const onDelete = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onDelete }))
    fireKey('ArrowDown') // 0 = folder-a
    fireKey('Delete')
    expect(onDelete).toHaveBeenCalledWith(files[0])
  })

  test('Cmd+A calls onSelectAll', () => {
    const onSelectAll = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onSelectAll }))
    fireKey('a', { metaKey: true })
    expect(onSelectAll).toHaveBeenCalled()
  })

  test('Cmd+A does not fire when modal is open', () => {
    const onSelectAll = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isModalOpen: true, onSelectAll }))
    fireKey('a', { metaKey: true })
    expect(onSelectAll).not.toHaveBeenCalled()
  })

  test('Cmd+A does not fire when preview is open', () => {
    const onSelectAll = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, isPreviewOpen: true, onSelectAll }))
    fireKey('a', { metaKey: true })
    expect(onSelectAll).not.toHaveBeenCalled()
  })

  test('Shift+ArrowDown adds next file to selection', () => {
    const onSetSelectedFileIds = jest.fn()
    const filesWithIds = [
      makeFile('1', 'folder-a', true),
      makeFile('2', 'file-b.txt'),
      makeFile('3', 'file-c.png'),
    ]
    renderHook(() =>
      useKeyboardNav({
        ...baseOptions,
        files: filesWithIds,
        selectedFileIds: [],
        onSetSelectedFileIds,
      })
    )
    fireKey('ArrowDown') // focus 0
    advanceThrottle()
    fireKey('ArrowDown', { shiftKey: true }) // extend to 1
    expect(onSetSelectedFileIds).toHaveBeenCalled()
    const arg = onSetSelectedFileIds.mock.calls[0][0]
    expect(arg).toContain('2') // file-b.txt id
  })

  test('typing a letter jumps to first file starting with that letter', () => {
    const filesForTypeAhead = [
      makeFile('1', 'alpha.txt'),
      makeFile('2', 'beta.txt'),
      makeFile('3', 'gamma.txt'),
    ]
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, files: filesForTypeAhead })
    )
    fireKey('b')
    expect(result.current.focusedIndex).toBe(1) // beta.txt
  })

  test('pressing the same letter after the reset timer clears jumps to next match', () => {
    const filesForTypeAhead = [
      makeFile('10', 'apple.txt'),
      makeFile('11', 'avocado.txt'),
      makeFile('12', 'banana.txt'),
    ]
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, files: filesForTypeAhead })
    )
    fireKey('a') // jumps to index 0 (apple)
    expect(result.current.focusedIndex).toBe(0)
    // Advance past the 500ms reset timer so the query clears, then press 'a' again
    act(() => { jest.advanceTimersByTime(600) })
    fireKey('a') // fresh single-char search from position 1 forward — finds avocado
    expect(result.current.focusedIndex).toBe(1)
  })

  test('type-ahead does not fire when modifier key is held', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    fireKey('f', { metaKey: true }) // Cmd+F should not type-ahead
    expect(result.current.focusedIndex).toBeNull()
  })

  test('type-ahead does not fire when an input is focused', () => {
    const { result } = renderHook(() => useKeyboardNav(baseOptions))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireKey('f')
    expect(result.current.focusedIndex).toBeNull()
    document.body.removeChild(input)
  })

  test('type-ahead does not fire when preview is open', () => {
    const filesForTypeAhead = [
      makeFile('1', 'alpha.txt'),
      makeFile('2', 'beta.txt'),
    ]
    const { result } = renderHook(() =>
      useKeyboardNav({ ...baseOptions, files: filesForTypeAhead, isPreviewOpen: true })
    )
    fireKey('b')
    expect(result.current.focusedIndex).toBeNull()
  })

  // ? shortcut moved to use-global-shortcuts — tested in use-global-shortcuts.test.ts

  // --- New file action shortcuts ---

  test('F on a focused file calls onFavorite', () => {
    const onFavorite = jest.fn()
    const { result } = renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite }))
    fireKey('ArrowDown')       // index 0: folder-a
    advanceThrottle()
    fireKey('ArrowDown')       // index 1: file-b.txt
    advanceThrottle()
    fireKey('f')
    expect(onFavorite).toHaveBeenCalledWith(files[1])
  })

  test('F on a focused folder does NOT call onFavorite', () => {
    const onFavorite = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite }))
    fireKey('ArrowDown')       // index 0: folder-a
    fireKey('f')
    expect(onFavorite).not.toHaveBeenCalled()
  })

  test('F does NOT trigger type-ahead (return not break)', () => {
    const onFavorite = jest.fn()
    const { result } = renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite }))
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown'); advanceThrottle() // index 1: file-b.txt
    const indexBefore = result.current.focusedIndex
    fireKey('f')
    expect(result.current.focusedIndex).toBe(indexBefore)
    expect(onFavorite).toHaveBeenCalledTimes(1)
  })

  test('Cmd+Shift+F calls onNewFolder', () => {
    const onNewFolder = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onNewFolder }))
    fireKey('f', { metaKey: true, shiftKey: true })
    expect(onNewFolder).toHaveBeenCalledTimes(1)
  })

  test('Cmd+Shift+F does not call onFavorite', () => {
    const onFavorite = jest.fn()
    const onNewFolder = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onFavorite, onNewFolder }))
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('f', { metaKey: true, shiftKey: true })
    expect(onFavorite).not.toHaveBeenCalled()
    expect(onNewFolder).toHaveBeenCalledTimes(1)
  })

  test('Cmd+L on a focused file calls onDirectLink', () => {
    const onDirectLink = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onDirectLink }))
    fireKey('ArrowDown'); advanceThrottle()
    fireKey('ArrowDown'); advanceThrottle() // index 1: file-b.txt
    fireKey('l', { metaKey: true })
    expect(onDirectLink).toHaveBeenCalledWith(files[1])
  })

  test('Cmd+Shift+S on a focused file calls onShare', () => {
    const onShare = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onShare }))
    fireKey('ArrowDown')
    fireKey('s', { metaKey: true, shiftKey: true })
    expect(onShare).toHaveBeenCalledWith(files[0])
  })

  test('Cmd+U calls onUpload regardless of focus', () => {
    const onUpload = jest.fn()
    renderHook(() => useKeyboardNav({ ...baseOptions, onUpload }))
    fireKey('u', { metaKey: true })
    expect(onUpload).toHaveBeenCalledTimes(1)
  })

  test('none of the new shortcuts fire when isModalOpen is true', () => {
    const onFavorite = jest.fn()
    const onDirectLink = jest.fn()
    const onShare = jest.fn()
    const onUpload = jest.fn()
    const onNewFolder = jest.fn()
    renderHook(() => useKeyboardNav({
      ...baseOptions,
      isModalOpen: true,
      onFavorite, onDirectLink, onShare, onUpload, onNewFolder,
    }))
    fireKey('f')
    fireKey('l', { metaKey: true })
    fireKey('s', { metaKey: true, shiftKey: true })
    fireKey('u', { metaKey: true })
    fireKey('f', { metaKey: true, shiftKey: true })
    expect(onFavorite).not.toHaveBeenCalled()
    expect(onDirectLink).not.toHaveBeenCalled()
    expect(onShare).not.toHaveBeenCalled()
    expect(onUpload).not.toHaveBeenCalled()
    expect(onNewFolder).not.toHaveBeenCalled()
  })

  test('Shift+ArrowUp adds previous file to selection', () => {
    const onSetSelectedFileIds = jest.fn()
    const filesWithIds = [
      makeFile('1', 'folder-a', true),
      makeFile('2', 'file-b.txt'),
      makeFile('3', 'file-c.png'),
    ]
    renderHook(() =>
      useKeyboardNav({
        ...baseOptions,
        files: filesWithIds,
        selectedFileIds: [],
        onSetSelectedFileIds,
      })
    )
    fireKey('ArrowDown') // 0
    advanceThrottle()
    fireKey('ArrowDown') // 1
    advanceThrottle()
    fireKey('ArrowUp', { shiftKey: true }) // extend up to 0
    expect(onSetSelectedFileIds).toHaveBeenCalled()
    const arg = onSetSelectedFileIds.mock.calls[0][0]
    expect(arg).toContain('1') // folder-a id
  })
})
