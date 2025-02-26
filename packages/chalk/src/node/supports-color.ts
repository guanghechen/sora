// Forked and refactor from: https://github.com/chalk/chalk/blob/f7b29ae8ef4fd2048e08aa361778d290ed10ce7a/source/vendor/supports-color/index.js#L1
import type { IChalkColorSupport } from '@guanghechen/chalk.types'
import { ColorSupportLevelEnum } from '@guanghechen/chalk.types'
import os from 'node:os'
import process from 'node:process'
import tty from 'node:tty'

const argv: string[] = (globalThis as any).Deno ? (globalThis as any).Deno.args : process.argv
const noFlagForceColor: ColorSupportLevelEnum | undefined = _envForceColor()
const flagForceColor: ColorSupportLevelEnum | undefined =
  noFlagForceColor ?? _defaultFlagForceColor()

export const supportsColor: IChalkColorSupport | false = _createSupportsColor(
  tty.isatty(1),
  true,
  true,
)
export const supportsColorStderr: IChalkColorSupport | false = _createSupportsColor(
  tty.isatty(2),
  true,
  true,
)

function _createSupportsColor(
  isTTY: boolean,
  hasStream: boolean,
  sniffFlags: boolean,
): IChalkColorSupport | false {
  const level = _supportsColor(isTTY, hasStream, sniffFlags)
  return _translateLevel(level)
}

function _hasFlag(flag: string): boolean {
  const prefix = flag.startsWith('-') ? '' : flag.length === 1 ? '-' : '--'
  const position = argv.indexOf(prefix + flag)
  const terminatorPosition = argv.indexOf('--')
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition)
}

function _envForceColor(): ColorSupportLevelEnum | undefined {
  if (process.env.FORCE_COLOR !== undefined) {
    if (process.env.FORCE_COLOR?.toLowerCase() === 'true') return ColorSupportLevelEnum.BASIC
    if (process.env.FORCE_COLOR?.toLowerCase() === 'false') return ColorSupportLevelEnum.DISABLED
    return process.env.FORCE_COLOR?.length === 0
      ? ColorSupportLevelEnum.BASIC
      : (Math.min(Number.parseInt(process.env.FORCE_COLOR ?? '', 10), 3) as ColorSupportLevelEnum)
  }
  return undefined
}

function _defaultFlagForceColor(): ColorSupportLevelEnum | undefined {
  if (
    _hasFlag('no-color') ||
    _hasFlag('no-colors') ||
    _hasFlag('color=false') ||
    _hasFlag('color=never')
  ) {
    return ColorSupportLevelEnum.DISABLED
  }

  if (
    _hasFlag('color') ||
    _hasFlag('colors') ||
    _hasFlag('color=true') ||
    _hasFlag('color=always')
  ) {
    return ColorSupportLevelEnum.BASIC
  }

  return undefined
}

function _translateLevel(level: ColorSupportLevelEnum): IChalkColorSupport | false {
  if (level === ColorSupportLevelEnum.DISABLED) return false

  return {
    level,
    hasBasic: true,
    has256: level >= ColorSupportLevelEnum.ANSI256,
    has16m: level >= ColorSupportLevelEnum.True16m,
  }
}

function _supportsColor(
  isTTY: boolean,
  hasStream: boolean,
  sniffFlags: boolean = true,
): ColorSupportLevelEnum {
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor
  if (forceColor === ColorSupportLevelEnum.DISABLED) return ColorSupportLevelEnum.DISABLED

  if (sniffFlags) {
    if (_hasFlag('color=16m') || _hasFlag('color=full') || _hasFlag('color=truecolor')) {
      return ColorSupportLevelEnum.True16m
    }
    if (_hasFlag('color=256')) return ColorSupportLevelEnum.ANSI256
  }

  // Check for Azure DevOps pipelines.
  // Has to be above the `!streamIsTTY` check.
  if (process.env.TF_BUILD !== undefined && process.env.AGENT_NAME !== undefined)
    return ColorSupportLevelEnum.BASIC
  if (hasStream && !isTTY && forceColor === undefined) return ColorSupportLevelEnum.DISABLED

  const min: ColorSupportLevelEnum = forceColor || ColorSupportLevelEnum.DISABLED
  if (process.env.TERM === 'dumb') return min

  if (process.platform === 'win32') {
    // Windows 10 build 10586 is the first Windows release that supports 256 colors.
    // Windows 10 build 14931 is the first release that supports 16m/TrueColor.
    const osRelease = os.release().split('.')
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10_586) {
      return Number(osRelease[2]) >= 14_931
        ? ColorSupportLevelEnum.True16m
        : ColorSupportLevelEnum.ANSI256
    }
    return ColorSupportLevelEnum.BASIC
  }

  if (process.env.CI !== undefined) {
    if (process.env.GITHUB_ACTIONS !== undefined || process.env.GITEA_ACTIONS !== undefined) {
      return ColorSupportLevelEnum.True16m
    }

    if (
      ['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(
        sign => sign in process.env,
      ) ||
      process.env.CI_NAME === 'codeship'
    ) {
      return ColorSupportLevelEnum.BASIC
    }

    return min
  }

  if (process.env.TEAMCITY_VERSION !== undefined) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(process.env.TEAMCITY_VERSION)
      ? ColorSupportLevelEnum.BASIC
      : ColorSupportLevelEnum.DISABLED
  }
  if (process.env.COLORTERM === 'truecolor') return ColorSupportLevelEnum.True16m
  if (process.env.TERM === 'xterm-kitty') return ColorSupportLevelEnum.True16m

  if (process.env.TERM_PROGRAM !== undefined) {
    const version = Number.parseInt((process.env.TERM_PROGRAM_VERSION || '').split('.')[0], 10)
    switch (process.env.TERM_PROGRAM) {
      case 'iTerm.app':
        return version >= ColorSupportLevelEnum.True16m
          ? ColorSupportLevelEnum.True16m
          : ColorSupportLevelEnum.ANSI256
      case 'Apple_Terminal':
        return ColorSupportLevelEnum.ANSI256
      default:
      // No default
    }
  }

  if (/-256(color)?$/i.test(process.env.TERM || '')) return ColorSupportLevelEnum.ANSI256
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(process.env.TERM || '')) {
    return ColorSupportLevelEnum.BASIC
  }
  if (process.env.COLORTERM !== undefined) return ColorSupportLevelEnum.BASIC
  return min
}
