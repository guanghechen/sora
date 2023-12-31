import type { IFileTree, IRawFileTreeNode } from '@guanghechen/filetree.types'
import { FileTree, caseSensitiveCmp, drawFileTree, isFileTreeOperationFailed } from '../../src'
import { fileTreeSerializer, getRawFileTreeNodes1 } from '../_suites'

expect.addSnapshotSerializer(fileTreeSerializer)

describe('drawFileTree', () => {
  let filetree: IFileTree

  beforeEach(() => {
    const { files, folders } = getRawFileTreeNodes1()
    const rawNodes: IRawFileTreeNode[] = [...files, ...folders]
    const result = FileTree.fromRawNodes(rawNodes, caseSensitiveCmp)
    if (isFileTreeOperationFailed(result)) {
      throw new Error(`Failed to build tree. code: ${result}`)
    }
    filetree = result
  })

  test('not collapsed', () => {
    const lines: string[] = [
      '',
      ...drawFileTree(
        filetree.root,
        {
          ident: '',
          collapse: false,
          depth: Number.MAX_SAFE_INTEGER,
          tailSlash: true,
        },
        caseSensitiveCmp,
      ),
      '',
    ]
    expect(lines.join('\n')).toMatchInlineSnapshot(`
      "
      ./
      ├── a/
      │   ├── b/
      │   │   ├── b/
      │   │   │   └── c/
      │   │   │       ├── d/
      │   │   │       │   └── f/
      │   │   │       └── e/
      │   │   ├── c/
      │   │   │   ├── d/
      │   │   │   │   ├── a.md
      │   │   │   │   └── e.md
      │   │   │   └── a.txt
      │   │   └── d/
      │   │       └── c.md
      │   └── d/
      │       └── c/
      │           └── b.md
      └── d/
          └── c/
              └── a/
      "
    `)
  })

  test('collapsed', () => {
    const lines: string[] = [
      '',
      ...drawFileTree(
        filetree.root,
        {
          ident: '',
          collapse: true,
          depth: Number.MAX_SAFE_INTEGER,
          tailSlash: true,
        },
        caseSensitiveCmp,
      ),
      '',
    ]
    expect(lines.join('\n')).toMatchInlineSnapshot(`
      "
      ./
      ├── a/
      │   ├── b/
      │   │   ├── b/c/
      │   │   │   ├── d/f/
      │   │   │   └── e/
      │   │   ├── c/
      │   │   │   ├── d/
      │   │   │   │   ├── a.md
      │   │   │   │   └── e.md
      │   │   │   └── a.txt
      │   │   └── d/c.md
      │   └── d/c/b.md
      └── d/c/a/
      "
    `)
  })

  test('depth 3 (not collapsed)', () => {
    const lines: string[] = [
      '',
      ...drawFileTree(
        filetree.root,
        {
          ident: '',
          collapse: false,
          depth: 3,
          tailSlash: true,
        },
        caseSensitiveCmp,
      ),
      '',
    ]
    expect(lines.join('\n')).toMatchInlineSnapshot(`
      "
      ./
      ├── a/
      │   ├── b/
      │   │   ├── b/
      │   │   ├── c/
      │   │   └── d/
      │   └── d/
      │       └── c/
      └── d/
          └── c/
              └── a/
      "
    `)
  })

  test('depth 3 (collapsed)', () => {
    const lines: string[] = [
      '',
      ...drawFileTree(
        filetree.root,
        {
          ident: '',
          collapse: true,
          depth: 3,
          tailSlash: true,
        },
        caseSensitiveCmp,
      ),
      '',
    ]
    expect(lines.join('\n')).toMatchInlineSnapshot(`
      "
      ./
      ├── a/
      │   ├── b/
      │   │   ├── c/
      └── d/c/a/
      "
    `)
  })

  test('depth 3 (not collapsed, no tail slash)', () => {
    const lines: string[] = [
      '',
      ...drawFileTree(
        filetree.root,
        {
          ident: '',
          collapse: false,
          depth: 3,
          tailSlash: false,
        },
        caseSensitiveCmp,
      ),
      '',
    ]
    expect(lines.join('\n')).toMatchInlineSnapshot(`
      "
      .
      ├── a
      │   ├── b
      │   │   ├── b
      │   │   ├── c
      │   │   └── d
      │   └── d
      │       └── c
      └── d
          └── c
              └── a
      "
    `)
  })

  test('depth 3 (collapsed, no tail slash)', () => {
    const lines: string[] = [
      '',
      ...drawFileTree(
        filetree.root,
        {
          ident: '',
          collapse: true,
          depth: 3,
          tailSlash: false,
        },
        caseSensitiveCmp,
      ),
      '',
    ]
    expect(lines.join('\n')).toMatchInlineSnapshot(`
      "
      .
      ├── a
      │   ├── b
      │   │   ├── c
      └── d/c/a
      "
    `)
  })
})
