import type { IChalkPair, ILevelStyle, ILevelStyleMap } from '../src/level'

describe('level types', () => {
  it('IChalkPair type should be valid', () => {
    const pair: IChalkPair = {
      fg: (text: string) => text,
      bg: (text: string) => text,
    }
    expect(pair.fg('test')).toBe('test')
    expect(pair.bg?.('test')).toBe('test')
  })

  it('IChalkPair without bg should be valid', () => {
    const pair: IChalkPair = {
      fg: (text: string) => text,
    }
    expect(pair.fg('test')).toBe('test')
    expect(pair.bg).toBeUndefined()
  })

  it('ILevelStyle type should be valid', () => {
    const style: ILevelStyle = {
      title: 'info ',
      labelChalk: { fg: (text: string) => text },
      contentChalk: { fg: (text: string) => text },
    }
    expect(style.title).toBe('info ')
    expect(style.labelChalk.fg('test')).toBe('test')
    expect(style.contentChalk.fg('test')).toBe('test')
  })

  it('ILevelStyleMap type should accept ReporterLevelEnum keys', () => {
    const mockChalk = (text: string): string => text
    const createStyle = (title: string): ILevelStyle => ({
      title,
      labelChalk: { fg: mockChalk },
      contentChalk: { fg: mockChalk },
    })

    const styleMap: ILevelStyleMap = {
      1: createStyle('debug'),
      2: createStyle('verb '),
      3: createStyle('info '),
      4: createStyle('warn '),
      5: createStyle('error'),
      6: createStyle('fatal'),
    }

    expect(styleMap[1].title).toBe('debug')
    expect(styleMap[3].title).toBe('info ')
    expect(styleMap[6].title).toBe('fatal')
  })
})
