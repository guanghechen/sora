import { vi } from 'vitest'
import { PathResolver } from '../src/PathResolver'
import { WorkspacePathResolver } from '../src/WorkspacePathResolver'

// Exercise Node's Windows path implementation on every test host.
vi.mock('node:path', async importOriginal => {
  const original = await importOriginal<typeof import('node:path')>()
  return { ...original, default: original.win32 }
})

describe.each([false, true])('Windows path containment (preferSlash: %s)', preferSlash => {
  const root = 'C:\\root'
  let resolver: PathResolver

  beforeEach(() => {
    resolver = new PathResolver({ preferSlash })
  })

  it.each([
    'D:\\outside.txt',
    'D:/root/../outside.txt',
    'D:\\root\\file.txt',
    '..\\outside.txt',
    '../outside.txt',
    'C:\\root-other\\file.txt',
  ])('rejects paths outside the root: %s', filepath => {
    expect(resolver.isSafeRelative(root, filepath)).toBe(false)
    expect(() => resolver.ensureSafeRelative(root, filepath)).toThrow('not under the root')
    expect(() => resolver.safeRelative(root, filepath)).toThrow('not under the root')
    expect(() => resolver.safeResolve(root, filepath)).toThrow('not under the root')
  })

  it('accepts the root and descendants on the same drive', () => {
    expect(resolver.isSafeRelative(root, root)).toBe(true)
    expect(resolver.safeRelative(root, root)).toBe('')
    expect(resolver.safeResolve(root, '')).toBe(root)

    for (const filepath of ['src\\file.ts', 'src/file.ts', 'C:\\root\\src\\file.ts']) {
      expect(resolver.isSafeRelative(root, filepath)).toBe(true)
      expect(resolver.safeResolve(root, filepath)).toBe('C:\\root\\src\\file.ts')
      expect(resolver.safeRelative(root, filepath)).toBe(
        preferSlash ? 'src/file.ts' : 'src\\file.ts',
      )
    }

    expect(resolver.isSafeRelative(root, 'c:\\ROOT\\src\\file.ts')).toBe(true)
  })

  it('rejects a relative root', () => {
    expect(resolver.isSafeRelative('root', 'file.txt')).toBe(false)
  })

  it('enforces the same boundary through WorkspacePathResolver', () => {
    const workspace = new WorkspacePathResolver(root, resolver)
    const filepath = 'D:\\outside.txt'
    expect(workspace.isSafePath(filepath)).toBe(false)
    expect(() => workspace.ensureSafePath(filepath)).toThrow('not under the root')
    expect(() => workspace.relative(filepath)).toThrow('not under the root')
    expect(() => workspace.resolve(filepath)).toThrow('not under the root')
    expect(workspace.resolve('src\\file.ts')).toBe('C:\\root\\src\\file.ts')
  })
})
