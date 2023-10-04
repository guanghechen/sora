import { ColorSupportLevelEnum } from '@guanghechen/internal'
import { supportsColor, supportsColorStderr } from './node/supports-color'
import { Chalk } from '.'

export { supportsColor, supportsColorStderr } from './node/supports-color'
export const chalk = Chalk.create(
  supportsColor ? supportsColor.level : ColorSupportLevelEnum.DISABLED,
)
export const chalkStderr = Chalk.create(
  supportsColorStderr ? supportsColorStderr.level : ColorSupportLevelEnum.DISABLED,
)
