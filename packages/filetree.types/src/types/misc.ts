export type INodeNameCompare = (u: string, v: string) => number

export interface IFileTreeDrawOptions {
  /**
   * Collapse empty paths.
   * @default false
   */
  collapse?: boolean
  /**
   * Max depth to print of the filetree.
   * @default Number.MAX_SAFE_INTEGER
   */
  depth?: number
  /**
   * Common ident of the entire filetree.
   * @default ''
   */
  ident?: string
  /**
   * Whether if show the tail slash for folder node.
   * @default false
   */
  tailSlash?: boolean
}
