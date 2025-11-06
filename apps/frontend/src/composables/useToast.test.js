import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { useToast } from './useToast'

// Mock document methods
const mockAppendChild = vi.fn()
const mockRemove = vi.fn()
const mockCreateElement = vi.fn(() => ({
  className: '',
  textContent: '',
  style: {},
  appendChild: mockAppendChild,
  remove: mockRemove,
}))

const mockGetElementById = vi.fn()

// Setup mocks before importing the module
beforeAll(() => {
  vi.spyOn(document, 'getElementById').mockImplementation(mockGetElementById)
  vi.spyOn(document, 'createElement').mockImplementation(mockCreateElement)
})

// Mock setTimeout
vi.useFakeTimers()

describe('useToast', () => {
  let toastContainer

  beforeEach(() => {
    vi.clearAllMocks()
    toastContainer = { appendChild: mockAppendChild }
    mockGetElementById.mockReturnValue(toastContainer)
    mockCreateElement.mockReturnValue({
      className: '',
      textContent: '',
      style: {},
      appendChild: mockAppendChild,
      remove: mockRemove,
    })
  })

  it('should return an object with show method', () => {
    const result = useToast()
    expect(result).toHaveProperty('show')
    expect(typeof result.show).toBe('function')
  })

  it('should create and display a toast with default settings', () => {
    const { show } = useToast()
    const message = 'Test message'

    show(message)

    expect(mockGetElementById).toHaveBeenCalledWith('toast-container')
    expect(mockCreateElement).toHaveBeenCalledWith('div')

    const createdElement = mockCreateElement.mock.results[0].value
    expect(createdElement.className).toBe('toast info')
    expect(createdElement.textContent).toBe(message)
    expect(createdElement.style.animation).toContain('toast-fade-in')
    expect(createdElement.style.animation).toContain('toast-fade-out')

    expect(mockAppendChild).toHaveBeenCalledWith(createdElement)

    // Fast-forward time to trigger removal
    vi.runAllTimers()
    expect(mockRemove).toHaveBeenCalled()
  })

  it('should create toast with success type', () => {
    const { show } = useToast()
    const message = 'Success message'

    show(message, 'success')

    const createdElement = mockCreateElement.mock.results[0].value
    expect(createdElement.className).toBe('toast success')
  })

  it('should create toast with error type', () => {
    const { show } = useToast()
    const message = 'Error message'

    show(message, 'error')

    const createdElement = mockCreateElement.mock.results[0].value
    expect(createdElement.className).toBe('toast error')
  })

  it('should use custom duration', () => {
    const { show } = useToast()
    const message = 'Custom duration message'
    const customDuration = 5000

    show(message, 'info', customDuration)

    const createdElement = mockCreateElement.mock.results[0].value
    expect(createdElement.style.animation).toContain(`toast-fade-out 500ms ${customDuration}ms forwards`)

    // Advance time by custom duration + animation
    vi.advanceTimersByTime(customDuration + 500)
    expect(mockRemove).toHaveBeenCalled()
  })

  it('should handle missing toast container gracefully', () => {
    mockGetElementById.mockReturnValue(null)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { show } = useToast()
    show('Test message')

    expect(consoleSpy).toHaveBeenCalledWith('Toast container with id "toast-container" not found in the DOM.')
    expect(mockCreateElement).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
