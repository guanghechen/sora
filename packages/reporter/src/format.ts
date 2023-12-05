import JSON5 from 'json5'

export const normalizeString = (
  data: unknown | null | undefined | (() => unknown | null | undefined),
  inline: boolean,
  replacer?: ((key: string, value: any) => any) | null,
): string => {
  const message: unknown | null | undefined =
    typeof data === 'function'
      ? data()
      : typeof (data as any)?.toJSON === 'function'
        ? (data as any).toJSON()
        : data

  if (message === null) return 'null'
  if (message === undefined) return 'undefined'
  switch (typeof message) {
    case 'string':
      return inline ? message.replace(/\s*\n\s*/g, ' ') : message
    case 'boolean':
      return message ? 'true' : 'false'
    case 'number':
      return String(message)
  }

  /* c8 ignore start */
  if (message instanceof Error) return message.stack ?? message.message ?? message.name
  /* c8 ignore stop */

  return inline ? JSON5.stringify(message, replacer, 0) : JSON5.stringify(message, replacer, 2)
}
