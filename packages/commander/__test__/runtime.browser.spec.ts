import { createBrowserCommandRuntime } from '../src/runtime/browser'

describe('runtime/browser', () => {
  it('should detect absolute paths', () => {
    const runtime = createBrowserCommandRuntime()

    expect(runtime.isAbsolute('/usr/bin')).toBe(true)
    expect(runtime.isAbsolute('\\\\server\\share')).toBe(true)
    expect(runtime.isAbsolute('C:\\Users\\alice')).toBe(true)
    expect(runtime.isAbsolute('relative/path')).toBe(false)
  })

  it('should resolve with current working directory when no path is provided', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/workspace')
    const runtime = createBrowserCommandRuntime()

    expect(runtime.resolve()).toBe('/workspace')

    cwdSpy.mockRestore()
  })

  it('should resolve POSIX-like path fragments', () => {
    const runtime = createBrowserCommandRuntime()

    expect(runtime.resolve('/a/b', '', './c', '../d', 'e')).toBe('/a/b/d/e')
    expect(runtime.resolve('/a/b', '/x/y')).toBe('/x/y')
  })

  it('should resolve Windows-like path fragments', () => {
    const runtime = createBrowserCommandRuntime()

    expect(runtime.resolve('C:\\base\\dir', '..\\next')).toBe('/C:/base/next')
    expect(runtime.resolve('C:\\base\\dir', '.\\child')).toBe('/C:/base/dir/child')
  })

  it('should trim trailing slash when resolving back to Windows drive root', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('C:\\workspace\\project')
    const runtime = createBrowserCommandRuntime()

    expect(runtime.resolve('..', '..')).toBe('C:')

    cwdSpy.mockRestore()
  })

  it('should use process.cwd for cwd()', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/commander')
    const runtime = createBrowserCommandRuntime()

    expect(runtime.cwd()).toBe('/tmp/commander')

    cwdSpy.mockRestore()
  })

  it('should fallback to root path when process.cwd is unavailable', () => {
    vi.stubGlobal('process', undefined)
    const runtime = createBrowserCommandRuntime()

    expect(runtime.cwd()).toBe('/')
    expect(runtime.resolve()).toBe('/')

    vi.unstubAllGlobals()
  })

  it('should reject readFile in browser runtime', async () => {
    const runtime = createBrowserCommandRuntime()

    await expect(runtime.readFile('/tmp/file')).rejects.toThrow(
      'runtime does not support file-system operation: readFile',
    )
  })

  it('should reject stat in browser runtime', async () => {
    const runtime = createBrowserCommandRuntime()

    await expect(runtime.stat('/tmp/file')).rejects.toThrow(
      'runtime does not support file-system operation: stat',
    )
  })
})
