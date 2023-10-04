import { Chalk, } from '../src'
import { ColorSupportLevelEnum } from '../src/shared/constant'

describe('chalk', () => {
  it("don't output colors when manually disabled", () => {
    const chalk = Chalk.create(ColorSupportLevelEnum.DISABLED)
    expect(chalk.red('foo')).toEqual('foo')
  })

  it('colors can be forced by using chalk.level', () => {
    const chalk = Chalk.create(ColorSupportLevelEnum.BASIC)
    expect(chalk.green('hello')).toEqual('\u001B[32mhello\u001B[39m')
    // expect(chalk.rgb(2, 3, 4).yellow('hello', chalk.red('world!'))).toEqual(
    //   '\u0033[30m\u0033[33mhello \u0033[31mworld!\u0033[33m\u0033[39m\u0033[39m',
    // )
  })
})
