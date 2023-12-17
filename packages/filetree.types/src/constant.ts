export enum FileTreeNodeTypeEnum {
  FILE = 'FILE',
  FOLDER = 'FOLDER',
}

export enum FileTreeErrorCodeEnum {
  /**
   * At least one ancestor node is of target node not a folder.
   */
  DST_ANCESTOR_NOT_FOLDER = 'DST_ANCESTOR_NOT_FOLDER',
  /**
   * The tree node already existed.
   */
  DST_NODE_EXIST = 'DST_NODE_EXIST',
  /**
   * The tree node is a folder.
   */
  DST_NODE_IS_FOLDER = 'DST_NODE_IS_FOLDER',
  /**
   * The tree node does not exist.
   */
  DST_NODE_NONEXISTENT = 'DST_NODE_NONEXISTENT',
  /**
   * The original node type and the target node type are conflicted.
   */
  NODE_TYPE_CONFLICT = 'NODE_TYPE_CONFLICT',
  /**
   * At least one ancestor node is of src node not a folder.
   */
  SRC_ANCESTOR_NOT_FOLDER = 'SRC_ANCESTOR_NOT_FOLDER',
  /**
   * The src node is already existed.
   */
  SRC_NODE_EXIST = 'SRC_NODE_EXIST',
  /**
   * The src node does not exist.
   */
  SRC_NODE_NONEXISTENT = 'SRC_NODE_NONEXISTENT',
  /**
   * The src node is not a file.
   */
  SRC_NODE_IS_NOT_FILE = 'SRC_NODE_IS_NOT_FILE',
  /**
   * The src node is not a folder.
   */
  SRC_NODE_IS_NOT_FOLDER = 'SRC_NODE_IS_NOT_FOLDER',
  /**
   * The src node is a folder and has at least one child.
   */
  SRC_CHILDREN_NOT_EMPTY = 'SRC_CHILDREN_NOT_EMPTY',
}
