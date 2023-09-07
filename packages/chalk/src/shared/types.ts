export const enum ColorSupportLevelEnum {
  DISABLED = 0, // All colors disabled.
  BASIC = 1, // Basic 16 colors support.
  ANSI256 = 2, // ANSI 256 colors support.
  True16m = 3, // Truecolor 16 million colors support.
}

export interface IChalkColorSupport {
  /**
   * The color level.
   */
  level: ColorSupportLevelEnum

  /**
   * Whether basic 16 colors are supported.
   */
  hasBasic: boolean

  /**
   * Whether ANSI 256 colors are supported.
   */
  has256: boolean

  /**
   * Whether Truecolor 16 million colors are supported.
   */
  has16m: boolean
}
