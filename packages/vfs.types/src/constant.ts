export enum VfsErrorCode {
  PARENT_SOURCE_NOT_FOUND = 1,
  PARENT_SOURCE_NOT_DIRECTORY = 2,
  SOURCE_NOT_FOUND = 3,
  SOURCE_EXIST = 4,
  SOURCE_IS_DIRECTORY = 5,
  SOURCE_NOT_DIRECTORY = 6,
  SOURCE_NO_PERMISSION = 7,
  PARENT_TARGET_NOT_FOUND = 8,
  PARENT_TARGET_NOT_DIRECTORY = 9,
  TARGET_NOT_FOUND = 10,
  TARGET_EXIST = 11,
  TARGET_IS_DIRECTORY = 12,
  TARGET_NOT_DIRECTORY = 13,
  TARGET_NO_PERMISSION = 14,
}

export enum VfsFileType {
  FILE = 'file',
  DIRECTORY = 'directory',
  SYMBOLIC = 'symbolic',
  UNKNOWN = 'unknown',
}

export function isVfsOperationSucceed<T extends Exclude<unknown, VfsErrorCode>>(
  codeOrResult: T | VfsErrorCode,
): codeOrResult is T{
  return typeof codeOrResult !== 'number'
}
