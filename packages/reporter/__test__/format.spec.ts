import { normalizeString } from '../src/format'

describe('normalizeString', () => {
  it('basic', () => {
    const suites = [
      [undefined, 'undefined', 'undefined'],
      [null, 'null', 'null'],
      [true, 'true', 'true'],
      [false, 'false', 'false'],
      [0, '0', '0'],
      [-1, '-1', '-1'],
      [1.2, '1.2', '1.2'],
      [[], '[]', '[]'],
      [{}, '{}', '{}'],
      [{ name: 'bob' }, "{name:'bob'}", "{\n  name: 'bob',\n}"],
      ['', '', ''],
      ['Hello, world!', 'Hello, world!', 'Hello, world!'],
      [
        {
          name: 'waw',
          toJSON() {
            return { name: 'alice' }
          },
        },
        "{name:'alice'}",
        "{\n  name: 'alice',\n}",
      ],
    ]

    for (const func of [true, false]) {
      for (const [input, answerInline, answer] of suites) {
        expect([func, normalizeString(func ? () => input : input, true)]).toEqual([
          func,
          answerInline,
        ])

        expect([func, normalizeString(func ? () => input : input, false)]).toEqual([func, answer])
      }
    }
  })
})
