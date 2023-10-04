// Forked and refactor from: https://github.com/chalk/chalk/blob/f7b29ae8ef4fd2048e08aa361778d290ed10ce7a/source/vendor/supports-color/browser.js#L1
import type { IChalkColorSupport } from '@guanghechen/internal'
import { ColorSupportLevelEnum } from '@guanghechen/internal'

const level: ColorSupportLevelEnum = (() => {
  if (typeof window !== 'undefined' && window.navigator) {
    const userAgentData = (window.navigator as any).userAgentData as {
      brands: Array<{ brand: string; version: number }>
    }

    if (userAgentData) {
      const brand = userAgentData.brands.find(({ brand }) => brand === 'Chromium')
      if (brand && brand.version > 93) {
        return ColorSupportLevelEnum.True16m
      }
    }

    if (/\b(Chrome|Chromium)\//.test(navigator.userAgent)) return ColorSupportLevelEnum.BASIC
  }
  return ColorSupportLevelEnum.DISABLED
})()

const colorSupport: IChalkColorSupport | false =
  level === ColorSupportLevelEnum.DISABLED
    ? false
    : {
        level,
        hasBasic: true,
        has256: level >= ColorSupportLevelEnum.ANSI256,
        has16m: level >= ColorSupportLevelEnum.True16m,
      }

export const supportsColor: IChalkColorSupport | false = colorSupport
export const supportsColorStderr: IChalkColorSupport | false = colorSupport
