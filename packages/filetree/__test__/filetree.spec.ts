import type {
  IFileTree,
  IFileTreeFolderNodeInstance,
  IFileTreeNodeInstance,
  IRawFileTreeNode,
} from '@guanghechen/filetree.types'
import {
  FileTree,
  FileTreeErrorCodeEnum,
  FileTreeNodeTypeEnum,
  caseSensitiveCmp,
  isFileTreeOperationFailed,
  isFileTreeOperationSucceed,
} from '../src'
import { fileTreeSerializer, getRawFileTreeNodes1 } from './_suites'

expect.addSnapshotSerializer(fileTreeSerializer)

describe('FileTree', () => {
  let BASELINE_ROOT: IFileTree

  let filetree: IFileTree
  let rawNodes: IRawFileTreeNode[]
  let rawFileNodes: IRawFileTreeNode[]
  let rawFolderNodes: IRawFileTreeNode[]

  // a-prefix: means there is at least one ancestor of the path is not a folder.
  // n-prefix: means the path not exist.
  // f-prefix: means the path indicate to a file.
  // d-prefix: means the path indicate to a folder.
  let aPathFromRoot: string[]
  let nPathFromRoot: string[]
  let fPathFromRoot1: string[]
  let fPathFromRoot2: string[]
  // let dPathFromRoot1: string[]
  // let dPathFromRoot2: string[]

  beforeAll(() => {
    const { files, folders } = getRawFileTreeNodes1()
    const rawNodes = [...files, ...folders]
    const result = FileTree.fromRawNodes(rawNodes, caseSensitiveCmp)
    if (isFileTreeOperationFailed(result)) {
      throw new Error(`Failed to build tree. code: ${result}`)
    }
    BASELINE_ROOT = result
  })

  beforeEach(() => {
    const { files, folders } = getRawFileTreeNodes1()
    rawNodes = [...files, ...folders]
    rawFileNodes = files
    rawFolderNodes = folders

    aPathFromRoot = rawFileNodes[0].pathFromRoot.concat('b/a.txt')
    nPathFromRoot = rawFolderNodes[0].pathFromRoot.concat(['non-exist', 'cool'])
    fPathFromRoot1 = rawFileNodes[0].pathFromRoot.slice()
    fPathFromRoot2 = rawFileNodes[1].pathFromRoot.slice()
    dPathFromRoot1 = rawFolderNodes[0].pathFromRoot.slice()
    dPathFromRoot2 = rawFolderNodes[1].pathFromRoot.slice()

    const result = FileTree.fromRawNodes(rawNodes, caseSensitiveCmp)
    if (isFileTreeOperationFailed(result)) {
      throw new Error(`Failed to build tree. code: ${result}`)
    }
    filetree = result
  })

  afterEach(() => {
    // eslint-disable-next-line jest/no-standalone-expect
    expect(filetree.root).toBe(BASELINE_ROOT.root)
  })

  describe('fromRawNodes', () => {
    test('NODE_TYPE_CONFLICT', () => {
      const badRawFileTreeNodes: IRawFileTreeNode[] = [
        {
          ...rawFileNodes[0],
        },
        {
          type: FileTreeNodeTypeEnum.FOLDER,
          pathFromRoot: rawFileNodes[0].pathFromRoot,
        },
      ]

      const errorCode = FileTree.fromRawNodes(badRawFileTreeNodes, caseSensitiveCmp)
      expect(isFileTreeOperationFailed(errorCode)).toEqual(true)
      expect(errorCode).toEqual(FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT)
    })

    test('SRC_ANCESTOR_NOT_FOLDER', () => {
      const badRawFileTreeNodes: IRawFileTreeNode[] = [
        {
          ...rawFileNodes[0],
        },
        {
          ...rawFileNodes[0],
          pathFromRoot: rawFileNodes[0].pathFromRoot.concat('/b/alice.txt'),
        },
      ]

      const errorCode = FileTree.fromRawNodes(badRawFileTreeNodes, caseSensitiveCmp)
      expect(isFileTreeOperationFailed(errorCode)).toEqual(true)
      expect(errorCode).toEqual(FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER)
    })
  })

  test('cache', () => {
    expect(filetree.root).toBe(BASELINE_ROOT.root)
  })

  test('draw', () => {
    const lines: string[] = [
      '',
      ...filetree.draw({
        ident: '',
        collapse: false,
        depth: Number.MAX_SAFE_INTEGER,
        tailSlash: false,
      }),
      '',
    ]
    expect(lines.join('\n')).toMatchInlineSnapshot(`
      "
      .
      ├── a
      │   ├── b
      │   │   ├── b
      │   │   │   └── c
      │   │   │       ├── d
      │   │   │       │   └── f
      │   │   │       └── e
      │   │   ├── c
      │   │   │   ├── d
      │   │   │   │   ├── a.md
      │   │   │   │   └── e.md
      │   │   │   └── a.txt
      │   │   └── d
      │   │       └── c.md
      │   └── d
      │       └── c
      │           └── b.md
      └── d
          └── c
              └── a
      "
    `)
  })

  describe('insert', () => {
    test('SRC_NODE_EXIST', () => {
      {
        const result = filetree.insert(
          {
            type: FileTreeNodeTypeEnum.FILE,
            pathFromRoot: rawFileNodes[0].pathFromRoot,
            ctime: 33,
            mtime: 34,
            size: 35,
          },
          false,
        )
        expect(isFileTreeOperationFailed(result)).toEqual(true)
        expect(result).toEqual(FileTreeErrorCodeEnum.SRC_NODE_EXIST)
      }

      {
        const result = filetree.insert(
          {
            type: FileTreeNodeTypeEnum.FOLDER,
            pathFromRoot: rawFileNodes[0].pathFromRoot,
          },
          false,
        )
        expect(isFileTreeOperationFailed(result)).toEqual(true)
        expect(result).toEqual(FileTreeErrorCodeEnum.SRC_NODE_EXIST)
      }
    })

    test('NODE_TYPE_CONFLICT', () => {
      {
        const result = filetree.insert(
          {
            type: FileTreeNodeTypeEnum.FILE,
            pathFromRoot: rawFolderNodes[0].pathFromRoot,
            ctime: 33,
            mtime: 34,
            size: 35,
          },
          true,
        )
        expect(isFileTreeOperationFailed(result)).toEqual(true)
        expect(result).toEqual(FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT)
      }

      {
        const result = filetree.insert(
          {
            type: FileTreeNodeTypeEnum.FOLDER,
            pathFromRoot: rawFileNodes[0].pathFromRoot,
          },
          true,
        )
        expect(isFileTreeOperationFailed(result)).toEqual(true)
        expect(result).toEqual(FileTreeErrorCodeEnum.NODE_TYPE_CONFLICT)
      }
    })

    test('SRC_ANCESTOR_NOT_FOLDER', () => {
      {
        const result = filetree.insert(
          {
            type: FileTreeNodeTypeEnum.FILE,
            pathFromRoot: rawFileNodes[0].pathFromRoot.concat('c/d/alice.md'),
            ctime: 20,
            mtime: 30,
            size: 0,
          },
          false,
        )
        expect(isFileTreeOperationFailed(result)).toEqual(true)
        expect(result).toEqual(FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER)
      }

      {
        const result = filetree.insert(
          {
            type: FileTreeNodeTypeEnum.FOLDER,
            pathFromRoot: rawFileNodes[0].pathFromRoot.concat('c/d/alice.md'),
          },
          true,
        )
        expect(isFileTreeOperationFailed(result)).toEqual(true)
        expect(result).toEqual(FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER)
      }
    })

    test('from scratch', () => {
      const errorCodeOrFileTree = FileTree.fromRawNodes([], caseSensitiveCmp)
      if (isFileTreeOperationFailed(errorCodeOrFileTree)) {
        throw new Error('[from scratch] failed to create empty node.')
      }

      const noob: IFileTree = errorCodeOrFileTree
      for (const rawNode of rawNodes) {
        const result = noob.insert(rawNode, true)
        if (isFileTreeOperationFailed(result)) {
          throw new Error(
            `[from scratch] failed to insert rawNode. ${rawNode.pathFromRoot.join('/')}`,
          )
        }
        noob.attach(result)
      }

      expect('\n' + noob.draw().join('\n') + '\n').toMatchInlineSnapshot(`
        "
        .
        ├── a
        │   ├── b
        │   │   ├── b
        │   │   │   └── c
        │   │   │       ├── d
        │   │   │       │   └── f
        │   │   │       └── e
        │   │   ├── c
        │   │   │   ├── d
        │   │   │   │   ├── a.md
        │   │   │   │   └── e.md
        │   │   │   └── a.txt
        │   │   └── d
        │   │       └── c.md
        │   └── d
        │       └── c
        │           └── b.md
        └── d
            └── c
                └── a
        "
      `)
      expect(noob.root).toBe(filetree.root)
    })
  })

  describe('move', () => {
    describe('file2file', () => {
      test('DST_ANCESTOR_NOT_FOLDER', () => {
        const srcPathFromRoot: string[] = fPathFromRoot1
        const dstPathFromRoot: string[] = aPathFromRoot

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
          FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
          FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(
          FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).toBe(
          FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
        )
      })

      test('DST_NODE_EXIST', () => {
        const srcPathFromRoot: string[] = fPathFromRoot1
        const dstPathFromRoot: string[] = fPathFromRoot2

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        )

        // Once the overwrite has been set, then the DST_NODE_EXIST will be ignored.

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).not.toBe(
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).not.toBe(
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        )
      })

      test('DST_NODE_IS_FOLDER', () => {})

      test('NODE_TYPE_CONFLICT', () => {})

      test('SRC_ANCESTOR_NOT_FOLDER', () => {
        const srcPathFromRoot: string[] = aPathFromRoot
        const dstPathFromRoot: string[] = fPathFromRoot1

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
          FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
          FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(
          FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).toBe(
          FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
        )
      })

      test('SRC_NODE_NONEXISTENT', () => {
        const srcPathFromRoot: string[] = nPathFromRoot
        const dstPathFromRoot: string[] = fPathFromRoot1

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
          FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
          FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(
          FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).toBe(
          FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
        )
      })

      test('SRC_CHILDREN_NOT_EMPTY', () => {})

      test('same', () => {
        const srcPathFromRoot = fPathFromRoot1
        const dstPathFromRoot = fPathFromRoot1
        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(filetree.root)
        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(filetree.root)
        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(filetree.root)
        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).toBe(filetree.root)
      })

      test('new', () => {
        const srcPathFromRoot = fPathFromRoot1
        const dstPathFromRoot = nPathFromRoot
        const originalSrcNode = filetree.find(srcPathFromRoot) as IFileTreeNodeInstance

        expect(isFileTreeOperationSucceed(originalSrcNode)).toBe(true)
        expect(originalSrcNode).not.toBe(undefined)

        for (const overwrite of [false, true]) {
          for (const recursive of [false, true]) {
            const result = filetree.rename(srcPathFromRoot, dstPathFromRoot, overwrite, recursive)
            expect(isFileTreeOperationSucceed(result)).toBe(true)
            expect(filetree.find(srcPathFromRoot)).toBe(originalSrcNode)
            expect(filetree.find(dstPathFromRoot)).toBe(undefined)

            const filetree2: IFileTree = filetree.launch(result as IFileTreeFolderNodeInstance)
            expect('\n' + filetree2.draw().join('\n') + '\n').toMatchInlineSnapshot(`
              "
              .
              ├── a
              │   ├── b
              │   │   ├── b
              │   │   │   └── c
              │   │   │       ├── d
              │   │   │       │   └── f
              │   │   │       │       └── non-exist
              │   │   │       │           └── cool
              │   │   │       └── e
              │   │   ├── c
              │   │   │   └── d
              │   │   │       ├── a.md
              │   │   │       └── e.md
              │   │   └── d
              │   │       └── c.md
              │   └── d
              │       └── c
              │           └── b.md
              └── d
                  └── c
                      └── a
              "
            `)

            expect(filetree2.find(srcPathFromRoot)).toBe(undefined)
            expect(filetree2.find(dstPathFromRoot)).toBe(
              originalSrcNode.rename(dstPathFromRoot[dstPathFromRoot.length - 1]),
            )
          }
        }
      })

      test('overwrite', () => {
        const srcPathFromRoot = fPathFromRoot1
        const dstPathFromRoot = fPathFromRoot2

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        )

        expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        )

        const originalSrcNode = filetree.find(srcPathFromRoot) as IFileTreeNodeInstance
        const originalDstNode = filetree.find(dstPathFromRoot) as IFileTreeNodeInstance
        expect(isFileTreeOperationSucceed(originalSrcNode)).not.toBeUndefined()
        expect(isFileTreeOperationSucceed(originalDstNode)).not.toBeUndefined()

        for (const recursive of [false, true]) {
          const result = filetree.rename(srcPathFromRoot, dstPathFromRoot, true, recursive)
          expect(isFileTreeOperationSucceed(result)).toBe(true)
          expect(filetree.find(srcPathFromRoot)).toBe(originalSrcNode)
          expect(filetree.find(dstPathFromRoot)).toBe(originalDstNode)

          const filetree2: IFileTree = filetree.launch(result as IFileTreeFolderNodeInstance)
          expect('\n' + filetree2.draw().join('\n') + '\n').toMatchInlineSnapshot(`
            "
            .
            ├── a
            │   ├── b
            │   │   ├── b
            │   │   │   └── c
            │   │   │       ├── d
            │   │   │       │   └── f
            │   │   │       └── e
            │   │   ├── c
            │   │   │   └── d
            │   │   │       ├── a.md
            │   │   │       └── e.md
            │   │   └── d
            │   │       └── c.md
            │   └── d
            │       └── c
            │           └── b.md
            └── d
                └── c
                    └── a
            "
          `)

          expect(filetree2.find(srcPathFromRoot)).toBe(undefined)
          expect(filetree2.find(dstPathFromRoot)).toBe(
            originalSrcNode.rename(dstPathFromRoot[dstPathFromRoot.length - 1]),
          )
        }
      })
    })

    describe('file2folder', () => {})

    describe('folder2file', () => {})

    describe('folder2folder', () => {})

    test('DST_ANCESTOR_NOT_FOLDER', () => {
      const srcPathFromRoot: string[] = rawFileNodes[0].pathFromRoot.slice()
      const dstPathFromRoot: string[] = rawFileNodes[1].pathFromRoot.concat('c/d/alice.md')

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
        FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
        FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(
        FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).toBe(
        FileTreeErrorCodeEnum.DST_ANCESTOR_NOT_FOLDER,
      )
    })

    test('DST_NODE_EXIST', () => {
      interface ITestSuiteCase {
        srcPathFromRoot: string[]
        dstPathFromRoot: string[]
      }

      const file2file: ITestSuiteCase = {
        srcPathFromRoot: rawFileNodes[0].pathFromRoot.slice(),
        dstPathFromRoot: rawFileNodes[1].pathFromRoot.slice(),
      }
      const file2folder: ITestSuiteCase = {
        srcPathFromRoot: rawFileNodes[0].pathFromRoot.slice(),
        dstPathFromRoot: rawFolderNodes[0].pathFromRoot.slice(),
      }
      const folder2file: ITestSuiteCase = {
        srcPathFromRoot: rawFolderNodes[0].pathFromRoot.slice(),
        dstPathFromRoot: rawFileNodes[0].pathFromRoot.slice(),
      }
      const folder2folder: ITestSuiteCase = {
        srcPathFromRoot: rawFolderNodes[0].pathFromRoot.slice(),
        dstPathFromRoot: rawFolderNodes[1].pathFromRoot.slice(),
      }

      const suites: Array<{ srcPathFromRoot: string[]; dstPathFromRoot: string[] }> = [
        file2file,
        file2folder,
        folder2file,
        folder2folder,
      ]

      for (let i = 0; i < suites.length; ++i) {
        const { srcPathFromRoot, dstPathFromRoot } = suites[i]
        expect([i, filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)]).toEqual([
          i,
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        ])

        expect([i, filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)]).toEqual([
          i,
          FileTreeErrorCodeEnum.DST_NODE_EXIST,
        ])
      }
    })

    test('DST_NODE_IS_FOLDER', () => {})

    test('NODE_TYPE_CONFLICT', () => {})

    test('SRC_ANCESTOR_NOT_FOLDER', () => {
      const srcPathFromRoot: string[] = rawFileNodes[0].pathFromRoot.concat('c/d/alice.md')
      const dstPathFromRoot: string[] = rawFileNodes[1].pathFromRoot.slice()

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
        FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
        FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(
        FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).toBe(
        FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
      )
    })

    test('SRC_NODE_NONEXISTENT', () => {
      const srcPathFromRoot: string[] = rawFolderNodes[0].pathFromRoot.concat('non-exit/alice.txt')
      const dstPathFromRoot: string[] = rawFolderNodes[0].pathFromRoot.concat('alice.txt')

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
        FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, true)).toBe(
        FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(
        FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, true)).toBe(
        FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT,
      )
    })

    test('SRC_CHILDREN_NOT_EMPTY', () => {
      const srcPathFromRoot: string[] = rawFileNodes[0].pathFromRoot.slice(0, -1)
      const dstPathFromRoot: string[] = rawFolderNodes[0].pathFromRoot.concat('alice')

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, false, false)).toBe(
        FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY,
      )

      expect(filetree.rename(srcPathFromRoot, dstPathFromRoot, true, false)).toBe(
        FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY,
      )
    })

    test('same', () => {
      const pathFromRoots: Array<ReadonlyArray<string>> = [
        rawFileNodes[0].pathFromRoot,
        rawFolderNodes[0].pathFromRoot,
      ]

      for (const pathFromRoot of pathFromRoots) {
        expect(filetree.rename(pathFromRoot, pathFromRoot, false, false)).toBe(filetree.root)
        expect(filetree.rename(pathFromRoot, pathFromRoot, false, true)).toBe(filetree.root)
        expect(filetree.rename(pathFromRoot, pathFromRoot, true, false)).toBe(filetree.root)
        expect(filetree.rename(pathFromRoot, pathFromRoot, true, true)).toBe(filetree.root)
      }
    })
  })

  describe('remove', () => {
    test('SRC_ANCESTOR_NOT_FOLDER', () => {
      const pathFromRoot: string[] = rawFileNodes[0].pathFromRoot.concat('c/d')
      expect(filetree.remove(pathFromRoot, false)).toBe(
        FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
      )
      expect(filetree.remove(pathFromRoot, true)).toBe(
        FileTreeErrorCodeEnum.SRC_ANCESTOR_NOT_FOLDER,
      )
    })

    test('SRC_NODE_NONEXISTENT', () => {
      const pathFromRoot: string[] = rawFolderNodes[0].pathFromRoot.concat('c/d/alice.md')
      expect(filetree.remove(pathFromRoot, false)).toBe(FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT)
      expect(filetree.remove(pathFromRoot, true)).toBe(FileTreeErrorCodeEnum.SRC_NODE_NONEXISTENT)
    })

    test('SRC_CHILDREN_NOT_EMPTY', () => {
      const pathFromRoot: string[] = rawFileNodes[0].pathFromRoot.slice(0, -1)
      expect(filetree.find(pathFromRoot)).not.toBeUndefined()
      expect(filetree.remove(pathFromRoot, false)).toBe(
        FileTreeErrorCodeEnum.SRC_CHILDREN_NOT_EMPTY,
      )
      expect(filetree.find(pathFromRoot)).not.toBeUndefined()

      {
        const result = filetree.remove(pathFromRoot, true)
        expect(isFileTreeOperationFailed(result)).toEqual(false)

        const filetree2: IFileTree = filetree.launch(result as IFileTreeFolderNodeInstance)
        expect(filetree2.find(pathFromRoot)).toBeUndefined()
      }
    })

    test('remove all', () => {
      const newFiletree: IFileTree = filetree.launch(filetree.root)
      for (const rawNode of rawFileNodes) {
        const result = newFiletree.remove(rawNode.pathFromRoot, true)
        expect([result, isFileTreeOperationFailed(result)]).toEqual([result, false])
        newFiletree.attach(result as IFileTreeFolderNodeInstance)
      }

      expect('\n' + newFiletree.draw().join('\n') + '\n').toMatchInlineSnapshot(`
        "
        .
        ├── a
        │   ├── b
        │   │   ├── b
        │   │   │   └── c
        │   │   │       ├── d
        │   │   │       │   └── f
        │   │   │       └── e
        │   │   ├── c
        │   │   │   └── d
        │   │   └── d
        │   └── d
        │       └── c
        └── d
            └── c
                └── a
        "
      `)

      for (const rawNode of rawFolderNodes) {
        const result = newFiletree.remove(rawNode.pathFromRoot, false)
        expect(isFileTreeOperationFailed(result)).toEqual(false)
        newFiletree.attach(result as IFileTreeFolderNodeInstance)
      }

      expect('\n' + newFiletree.draw().join('\n') + '\n').toMatchInlineSnapshot(`
        "
        .
        ├── a
        │   ├── b
        │   │   ├── b
        │   │   │   └── c
        │   │   ├── c
        │   │   │   └── d
        │   │   └── d
        │   └── d
        │       └── c
        └── d
            └── c
        "
      `)
    })
  })

  test('toJSON', () => {
    const json = filetree.toJSON()
    expect(json).toMatchInlineSnapshot(`
      {
        "type": "FOLDER",
        "name": ".",
        "ctime": 0,
        "mtime": 370,
        "size": 1010,
        "children": [
          {
            "type": "FOLDER",
            "name": "a",
            "ctime": 70,
            "mtime": 370,
            "size": 1010,
            "children": [
              {
                "type": "FOLDER",
                "name": "b",
                "ctime": 70,
                "mtime": 170,
                "size": 530,
                "children": [
                  {
                    "type": "FOLDER",
                    "name": "b",
                    "ctime": 0,
                    "mtime": 0,
                    "size": 0,
                    "children": [
                      {
                        "type": "FOLDER",
                        "name": "c",
                        "ctime": 0,
                        "mtime": 0,
                        "size": 0,
                        "children": [
                          {
                            "type": "FOLDER",
                            "name": "d",
                            "ctime": 0,
                            "mtime": 0,
                            "size": 0,
                            "children": [
                              {
                                "type": "FOLDER",
                                "name": "f",
                                "ctime": 0,
                                "mtime": 0,
                                "size": 0,
                                "children": [],
                              },
                            ],
                          },
                          {
                            "type": "FOLDER",
                            "name": "e",
                            "ctime": 0,
                            "mtime": 0,
                            "size": 0,
                            "children": [],
                          },
                        ],
                      },
                    ],
                  },
                  {
                    "type": "FOLDER",
                    "name": "c",
                    "ctime": 70,
                    "mtime": 92,
                    "size": 330,
                    "children": [
                      {
                        "type": "FILE",
                        "name": "a.txt",
                        "ctime": 80,
                        "mtime": 80,
                        "size": 100,
                      },
                      {
                        "type": "FOLDER",
                        "name": "d",
                        "ctime": 70,
                        "mtime": 92,
                        "size": 230,
                        "children": [
                          {
                            "type": "FILE",
                            "name": "a.md",
                            "ctime": 70,
                            "mtime": 82,
                            "size": 110,
                          },
                          {
                            "type": "FILE",
                            "name": "e.md",
                            "ctime": 90,
                            "mtime": 92,
                            "size": 120,
                          },
                        ],
                      },
                    ],
                  },
                  {
                    "type": "FOLDER",
                    "name": "d",
                    "ctime": 170,
                    "mtime": 170,
                    "size": 200,
                    "children": [
                      {
                        "type": "FILE",
                        "name": "c.md",
                        "ctime": 170,
                        "mtime": 170,
                        "size": 200,
                      },
                    ],
                  },
                ],
              },
              {
                "type": "FOLDER",
                "name": "d",
                "ctime": 270,
                "mtime": 370,
                "size": 480,
                "children": [
                  {
                    "type": "FOLDER",
                    "name": "c",
                    "ctime": 270,
                    "mtime": 370,
                    "size": 480,
                    "children": [
                      {
                        "type": "FILE",
                        "name": "b.md",
                        "ctime": 270,
                        "mtime": 370,
                        "size": 480,
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            "type": "FOLDER",
            "name": "d",
            "ctime": 0,
            "mtime": 0,
            "size": 0,
            "children": [
              {
                "type": "FOLDER",
                "name": "c",
                "ctime": 0,
                "mtime": 0,
                "size": 0,
                "children": [
                  {
                    "type": "FOLDER",
                    "name": "a",
                    "ctime": 0,
                    "mtime": 0,
                    "size": 0,
                    "children": [],
                  },
                ],
              },
            ],
          },
        ],
      }
    `)
  })
})
