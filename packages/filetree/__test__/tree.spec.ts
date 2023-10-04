import type { IFileTree, IRawFileTreeNode } from '../src'
import { FileNodeStatusEnum, FileTree, FileTreeNodeTypeEnum } from '../src'

describe('basic', () => {
  let rawNodes: IRawFileTreeNode[]
  let filetree: IFileTree

  beforeEach(() => {
    rawNodes = [
      ...[
        'a/b/c/a.txt', //
        'a/b/c/d/e.md',
        'a/b/c/d/a.md',
        'a/b/d/c.md',
        'a/d/c/b.md',
      ].map(makeRawFileTreeNode),
      ...[
        'a/b/b/c/d/f', //
        'a/b/b/c/e',
        'a/b/b/c/d',
        'd/c/a',
      ].map(makeRawFolderTreeNode),
    ]
    filetree = FileTree.build(rawNodes, (x, y) => x.localeCompare(y))
  })

  test('snapshot', () => {
    expect(filetree.snapshot(-1)).toEqual([
      {
        type: 'folder',
        name: 'a',
        children: [
          {
            type: 'folder',
            name: 'b',
            children: [
              {
                type: 'folder',
                name: 'b',
                children: [
                  {
                    type: 'folder',
                    name: 'c',
                    children: [
                      {
                        type: 'folder',
                        name: 'd',
                        children: [
                          {
                            type: 'folder',
                            name: 'f',
                            children: [],
                          },
                        ],
                      },
                      {
                        type: 'folder',
                        name: 'e',
                        children: [],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'folder',
                name: 'c',
                children: [
                  {
                    type: 'folder',
                    name: 'd',
                    children: [
                      {
                        type: 'file',
                        name: 'a.md',
                      },
                      {
                        type: 'file',
                        name: 'e.md',
                      },
                    ],
                  },
                  {
                    type: 'file',
                    name: 'a.txt',
                  },
                ],
              },
              {
                type: 'folder',
                name: 'd',
                children: [
                  {
                    type: 'file',
                    name: 'c.md',
                  },
                ],
              },
            ],
          },
          {
            type: 'folder',
            name: 'd',
            children: [
              {
                type: 'folder',
                name: 'c',
                children: [
                  {
                    type: 'file',
                    name: 'b.md',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'folder',
        name: 'd',
        children: [
          {
            type: 'folder',
            name: 'c',
            children: [
              {
                type: 'folder',
                name: 'a',
                children: [],
              },
            ],
          },
        ],
      },
    ])

    expect(filetree.snapshot(0)).toEqual([
      {
        type: 'folder',
        name: 'a',
        children: [],
      },
      {
        type: 'folder',
        name: 'd',
        children: [],
      },
    ])
  })

  test('touch', () => {
    expect(filetree.touch([], -1)).toEqual(null)
    expect(filetree.touch([], 0)).toEqual(null)
    expect(filetree.touch([], 1)).toEqual(null)

    expect(filetree.touch(['a'], 1)).toEqual({
      type: 'folder',
      name: 'a',
      children: [
        {
          type: 'folder',
          name: 'b',
          children: [],
        },
        {
          type: 'folder',
          name: 'd',
          children: [],
        },
      ],
    })

    expect(filetree.touch(['a', 'b', 'c', 'a.txt'], 0)).toEqual({
      type: 'file',
      name: 'a.txt',
    })
  })

  test('stat', () => {
    for (const node of rawNodes) {
      expect(filetree.stat(node.paths)).toEqual(node.type)
    }
  })

  test('insert', () => {
    expect(filetree.stat(['f', 'c'])).toEqual(null)
    expect(filetree.insert(['f', 'c'], FileTreeNodeTypeEnum.FILE)).toEqual(
      FileNodeStatusEnum.NONEXISTENT,
    )
    expect(filetree.stat(['f', 'c'])).toEqual(FileTreeNodeTypeEnum.FILE)
    expect(filetree.insert(['f', 'c'], FileTreeNodeTypeEnum.FILE)).toEqual(FileNodeStatusEnum.EXIST)
    expect(filetree.insert(['f', 'c'], FileTreeNodeTypeEnum.FOLDER)).toEqual(
      FileNodeStatusEnum.CONFLICT,
    )
    expect(filetree.stat(['f', 'c'])).toEqual(FileTreeNodeTypeEnum.FILE)
  })

  test('remove', () => {
    expect(filetree.stat(['f', 'c'])).toEqual(null)
    expect(filetree.insert(['f', 'c'], FileTreeNodeTypeEnum.FILE)).toEqual(
      FileNodeStatusEnum.NONEXISTENT,
    )
    expect(filetree.stat(['f', 'c'])).toEqual(FileTreeNodeTypeEnum.FILE)

    expect(filetree.remove(['f', 'c'])).toEqual(FileNodeStatusEnum.EXIST)
    expect(filetree.remove(['f', 'c'])).toEqual(FileNodeStatusEnum.NONEXISTENT)

    expect(filetree.stat(['f', 'c'])).toEqual(null)
    expect(filetree.insert(['f', 'c'], FileTreeNodeTypeEnum.FOLDER)).toEqual(
      FileNodeStatusEnum.NONEXISTENT,
    )
    expect(filetree.stat(['f', 'c'])).toEqual(FileTreeNodeTypeEnum.FOLDER)
    expect(filetree.remove(['f', 'c'])).toEqual(FileNodeStatusEnum.EXIST)
  })
})

function makeRawFileTreeNode(filepath: string): IRawFileTreeNode {
  return {
    type: FileTreeNodeTypeEnum.FILE,
    paths: filepath.split(/[/\\]/g).filter(x => !!x),
  }
}

function makeRawFolderTreeNode(filepath: string): IRawFileTreeNode {
  return {
    type: FileTreeNodeTypeEnum.FOLDER,
    paths: filepath.split(/[/\\]/g).filter(x => !!x),
  }
}

/** js
function sortJson(json) {
  const o = {
    type: json.type,
    name: json.name,
  }
  for (const key of Object.keys(json)) {
    if (Object.hasOwn(o, key)) continue
    if (key === 'children') {
      o.children = json.children.map(sortJson)
      continue
    }
    o[key] = json[key]
  }
  return o
}
*/
