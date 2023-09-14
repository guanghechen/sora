import { supportsColor, supportsColorStderr } from './browser/supports-color'
import { Chalk, ColorSupportLevelEnum } from '.'

export { supportsColor, supportsColorStderr } from './browser/supports-color'
export const chalk = Chalk.create(
  supportsColor ? supportsColor.level : ColorSupportLevelEnum.DISABLED,
)
export const chalkStderr = Chalk.create(
  supportsColorStderr ? supportsColorStderr.level : ColorSupportLevelEnum.DISABLED,
)