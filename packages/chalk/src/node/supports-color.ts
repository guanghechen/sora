// Forked and refactor from: https://github.com/chalk/chalk/blob/f7b29ae8ef4fd2048e08aa361778d290ed10ce7a/source/vendor/supports-color/index.js#L1
import os from 'node:os'
import process from 'node:process'
import tty from 'node:tty'
import type { IChalkColorSupport } from '../shared/types'
import { ColorSupportLevelEnum } from '../shared/types'

const env: IProcessEnv = process.env as unknown as IProcessEnv
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

interface IProcessEnv {
  AGENT_NAME?: string
  CI?: string
  CI_NAME?: string
  COLORTERM?: string
  FORCE_COLOR?: string
  GITEA_ACTIONS?: string
  GITHUB_ACTIONS?: string
  TEAMCITY_VERSION?: string
  TERM?: string
  TERM_PROGRAM?: string
  TERM_PROGRAM_VERSION?: string
  TF_BUILD?: string
}

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
  if (env.FORCE_COLOR !== undefined) {
    if (env.FORCE_COLOR?.toLowerCase() === 'true') return ColorSupportLevelEnum.BASIC
    if (env.FORCE_COLOR?.toLowerCase() === 'false') return ColorSupportLevelEnum.DISABLED
    return env.FORCE_COLOR?.length === 0
      ? ColorSupportLevelEnum.BASIC
      : (Math.min(Number.parseInt(env.FORCE_COLOR ?? '', 10), 3) as ColorSupportLevelEnum)
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
  if (env.TF_BUILD !== undefined && env.AGENT_NAME !== undefined) return ColorSupportLevelEnum.BASIC
  if (hasStream && !isTTY && forceColor === undefined) return ColorSupportLevelEnum.DISABLED

  const min: ColorSupportLevelEnum = forceColor || ColorSupportLevelEnum.DISABLED
  if (env.TERM === 'dumb') return min

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

  if (env.CI !== undefined) {
    if (env.GITHUB_ACTIONS !== undefined || env.GITEA_ACTIONS !== undefined) {
      return ColorSupportLevelEnum.True16m
    }

    if (
      ['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(
        sign => sign in env,
      ) ||
      env.CI_NAME === 'codeship'
    ) {
      return ColorSupportLevelEnum.BASIC
    }

    return min
  }

  if (env.TEAMCITY_VERSION !== undefined) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION)
      ? ColorSupportLevelEnum.BASIC
      : ColorSupportLevelEnum.DISABLED
  }
  if (env.COLORTERM === 'truecolor') return ColorSupportLevelEnum.True16m
  if (env.TERM === 'xterm-kitty') return ColorSupportLevelEnum.True16m

  if (env.TERM_PROGRAM !== undefined) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10)
    switch (env.TERM_PROGRAM) {
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

  if (/-256(color)?$/i.test(env.TERM || '')) return ColorSupportLevelEnum.ANSI256
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM || '')) {
    return ColorSupportLevelEnum.BASIC
  }
  if (env.COLORTERM !== undefined) return ColorSupportLevelEnum.BASIC
  return min
}
