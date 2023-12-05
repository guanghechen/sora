import { ReporterLevelEnum, parseOptionsFromArgs } from '../src'

describe('command funcs', () => {
  describe('options', () => {
    test('default', () => {
      expect(parseOptionsFromArgs([])).toEqual({ flights: {} })
    })

    test('#1', () => {
      expect(
        parseOptionsFromArgs([
          '--log-level=debug',
          '--log-flight=date',
          '--log-flight=no-inline',
          '--log-flight=no-title',
          '--log-flight',
          'no-colorful',
          '--log-basename=waw',
          '--log-fake=alice'
        ]),
      ).toEqual({
        baseName: "waw",
        level: ReporterLevelEnum.DEBUG,
        flights: {
          date: true,
          title: false,
          inline: false,
          colorful: false,
        },
      })
    })

    test('#2', () => {
      expect(
        parseOptionsFromArgs([
          '--log-level=debug',
          '--log-flight=date,inline,no-colorful',
          'no-colorful',
        ]),
      ).toEqual({
        level: ReporterLevelEnum.DEBUG,
        flights: {
          date: true,
          inline: true,
          colorful: false,
        },
      })
    })

    test('#3', () => {
      const options = parseOptionsFromArgs(['--log-filepath="a/waw.txt"', '--log-encoding', 'gbk'])
      expect(options).toEqual({ flights: {} })
    })
  })
})
