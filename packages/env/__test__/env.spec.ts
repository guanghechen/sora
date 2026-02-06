import { describe, expect, it } from 'vitest'
import { parse, stringify } from '../src'

describe('parse', () => {
  it('should parse basic key-value pairs', () => {
    const result = parse('NAME=myapp\nPORT=3000')
    expect(result).toEqual({ NAME: 'myapp', PORT: '3000' })
  })

  it('should handle empty content', () => {
    expect(parse('')).toEqual({})
  })

  it('should handle empty values', () => {
    const result = parse('EMPTY=')
    expect(result).toEqual({ EMPTY: '' })
  })

  it('should ignore comments', () => {
    const result = parse('# comment\nNAME=value')
    expect(result).toEqual({ NAME: 'value' })
  })

  it('should ignore inline comments with space before #', () => {
    const result = parse('NAME=value # comment')
    expect(result).toEqual({ NAME: 'value' })
  })

  it('should keep # in value without preceding space', () => {
    const result = parse('COLOR=#fff')
    expect(result).toEqual({ COLOR: '#fff' })
  })

  it('should handle export prefix', () => {
    const result = parse('export NAME=value')
    expect(result).toEqual({ NAME: 'value' })
  })

  it('should skip lines with spaces around equals sign', () => {
    const result = parse('NAME = value\nVALID=ok')
    expect(result).toEqual({ VALID: 'ok' })
  })

  it('should handle single-quoted values without processing', () => {
    const result = parse("NAME='value'")
    expect(result).toEqual({ NAME: 'value' })
  })

  it('should not process escape sequences in single quotes', () => {
    const result = parse("MSG='line1\\nline2'")
    expect(result).toEqual({ MSG: 'line1\\nline2' })
  })

  it('should not interpolate variables in single quotes', () => {
    const result = parse("HOME=/opt\nDATA='${HOME}/data'")
    expect(result).toEqual({ HOME: '/opt', DATA: '${HOME}/data' })
  })

  it('should handle double-quoted values', () => {
    const result = parse('NAME="value"')
    expect(result).toEqual({ NAME: 'value' })
  })

  it('should handle escape sequences in double quotes', () => {
    const result = parse('MSG="line1\\nline2"')
    expect(result).toEqual({ MSG: 'line1\nline2' })
  })

  it('should handle escaped quotes in double quotes', () => {
    const result = parse('MSG="say \\"hello\\""')
    expect(result).toEqual({ MSG: 'say "hello"' })
  })

  it('should handle escaped backslash in double quotes', () => {
    const result = parse('PATH="C:\\\\Users\\\\test"')
    expect(result).toEqual({ PATH: 'C:\\Users\\test' })
  })

  it('should handle variable interpolation in double quotes', () => {
    const result = parse('HOME=/opt\nDATA="${HOME}/data"')
    expect(result).toEqual({ HOME: '/opt', DATA: '/opt/data' })
  })

  it('should handle variable interpolation in unquoted values', () => {
    const result = parse('HOME=/opt\nDATA=${HOME}/data')
    expect(result).toEqual({ HOME: '/opt', DATA: '/opt/data' })
  })

  it('should handle undefined variable interpolation', () => {
    const result = parse('DATA=${UNDEFINED}/data')
    expect(result).toEqual({ DATA: '/data' })
  })

  it('should handle escaped variable interpolation', () => {
    const result = parse('DATA=\\${HOME}/data')
    expect(result).toEqual({ DATA: '${HOME}/data' })
  })

  it('should handle multiple variable interpolations', () => {
    const result = parse('A=1\nB=2\nC=${A}-${B}')
    expect(result).toEqual({ A: '1', B: '2', C: '1-2' })
  })

  it('should handle CRLF line endings', () => {
    const result = parse('NAME=value\r\nPORT=3000')
    expect(result).toEqual({ NAME: 'value', PORT: '3000' })
  })

  it('should skip keys with dots (non-standard)', () => {
    const result = parse('my.key=value\nVALID=ok')
    expect(result).toEqual({ VALID: 'ok' })
  })

  it('should skip keys with dashes (non-standard)', () => {
    const result = parse('my-key=value\nVALID=ok')
    expect(result).toEqual({ VALID: 'ok' })
  })

  it('should accept keys starting with underscore', () => {
    const result = parse('_PRIVATE=secret\n__DOUBLE=value')
    expect(result).toEqual({ _PRIVATE: 'secret', __DOUBLE: 'value' })
  })

  it('should skip keys starting with number', () => {
    const result = parse('1KEY=value\nVALID=ok')
    expect(result).toEqual({ VALID: 'ok' })
  })

  it('should throw on unclosed double quote', () => {
    expect(() => parse('NAME="unclosed')).toThrow(SyntaxError)
    expect(() => parse('NAME="unclosed')).toThrow('Unclosed quote at line 1')
  })

  it('should throw on unclosed single quote', () => {
    expect(() => parse("NAME='unclosed")).toThrow(SyntaxError)
    expect(() => parse("NAME='unclosed")).toThrow('Unclosed quote at line 1')
  })

  it('should report correct line number for unclosed quote', () => {
    expect(() => parse('VALID=ok\nNAME="unclosed')).toThrow('Unclosed quote at line 2')
  })

  it('should skip lines without separator', () => {
    const result = parse('NOSEP\nNAME=value')
    expect(result).toEqual({ NAME: 'value' })
  })

  it('should skip lines with invalid key', () => {
    const result = parse('=value\nNAME=value')
    expect(result).toEqual({ NAME: 'value' })
  })

  it('should handle values containing colons', () => {
    const result = parse('URL=http://example.com:8080')
    expect(result).toEqual({ URL: 'http://example.com:8080' })
  })
})

describe('stringify', () => {
  it('should stringify basic key-value pairs', () => {
    const result = stringify({ NAME: 'myapp', PORT: '3000' })
    expect(result).toBe('NAME=myapp\nPORT=3000\n')
  })

  it('should handle empty object', () => {
    expect(stringify({})).toBe('')
  })

  it('should quote values with spaces', () => {
    const result = stringify({ MSG: 'hello world' })
    expect(result).toBe('MSG="hello world"\n')
  })

  it('should escape double quotes in values', () => {
    const result = stringify({ MSG: 'say "hello"' })
    expect(result).toBe('MSG="say \\"hello\\""\n')
  })

  it('should escape newlines in values', () => {
    const result = stringify({ MSG: 'line1\nline2' })
    expect(result).toBe('MSG="line1\\nline2"\n')
  })

  it('should escape backslashes in values', () => {
    const result = stringify({ PATH: 'C:\\Users\\test' })
    expect(result).toBe('PATH="C:\\\\Users\\\\test"\n')
  })

  it('should quote values with #', () => {
    const result = stringify({ COLOR: '#fff' })
    expect(result).toBe('COLOR="#fff"\n')
  })

  it('should exclude specified keys', () => {
    const result = stringify({ NAME: 'myapp', SECRET: 'hidden' }, { exclude: ['SECRET'] })
    expect(result).toBe('NAME=myapp\n')
  })
})

describe('roundtrip', () => {
  it('should roundtrip simple values', () => {
    const original = { NAME: 'myapp', PORT: '3000' }
    const result = parse(stringify(original))
    expect(result).toEqual(original)
  })

  it('should roundtrip values with special characters', () => {
    const original = { MSG: 'hello "world"', DESC: 'line1\nline2' }
    const result = parse(stringify(original))
    expect(result).toEqual(original)
  })

  it('should roundtrip values with backslashes', () => {
    const original = { PATH: 'C:\\Users\\test' }
    const result = parse(stringify(original))
    expect(result).toEqual(original)
  })

  it('should roundtrip values with #', () => {
    const original = { COLOR: '#fff', URL: 'http://example.com#anchor' }
    const result = parse(stringify(original))
    expect(result).toEqual(original)
  })
})
