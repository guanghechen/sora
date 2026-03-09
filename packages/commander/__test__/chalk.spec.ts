import { TERMINAL_STYLE, styleText } from '../src/command/chalk'

describe('chalk', () => {
  it('should wrap text with terminal styles and reset token', () => {
    const styled = styleText('hello', TERMINAL_STYLE.bold, TERMINAL_STYLE.cyan)
    expect(styled).toBe(`\u001b[1m\u001b[36mhello\u001b[0m`)
  })
})
