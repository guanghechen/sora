import type { ColorSupportLevelEnum } from '../constant'

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

export interface IColorPair {
  /**
   * The ANSI terminal control sequence for starting this style.
   */
  readonly open: string

  /**
   * The ANSI terminal control sequence for ending this style.
   */
  readonly close: string
}

export interface IModifier {
  /**
   * Resets the current color chain.
   */
  readonly reset: IColorPair

  /**
   * Make text bold.
   */
  readonly bold: IColorPair

  /**
   * Emitting only a small amount of light.
   */
  readonly dim: IColorPair

  /**
   * Make text italic. (Not widely supported)
   */
  readonly italic: IColorPair

  /**
   * Make text underline. (Not widely supported)
   */
  readonly underline: IColorPair

  /**
   * Make text overline.
   * Supported on VTE-based terminals, the GNOME terminal, mintty, and Git Bash.
   */
  readonly overline: IColorPair

  /**
   * Inverse background and foreground colors.
   */
  readonly inverse: IColorPair

  /**
   * Prints the text, but makes it invisible.
   */
  readonly hidden: IColorPair

  /**
   * Puts a horizontal line through the center of the text. (Not widely supported)
   */
  readonly strikethrough: IColorPair
}

export interface IChalkColor {
  readonly close: string
  ansi(code: number): string
  ansi256(code: number): string
  ansi16m(r: number, g: number, b: number): string
}

export interface IForegroundColor extends IChalkColor {
  readonly black: IColorPair
  readonly red: IColorPair
  readonly green: IColorPair
  readonly yellow: IColorPair
  readonly blue: IColorPair
  readonly cyan: IColorPair
  readonly magenta: IColorPair
  readonly white: IColorPair

  // Alias for `blackBright`.
  readonly gray: IColorPair

  // Alias for `blackBright`.
  readonly grey: IColorPair

  readonly blackBright: IColorPair
  readonly redBright: IColorPair
  readonly greenBright: IColorPair
  readonly yellowBright: IColorPair
  readonly blueBright: IColorPair
  readonly cyanBright: IColorPair
  readonly magentaBright: IColorPair
  readonly whiteBright: IColorPair
}

export interface IBackgroundColor extends IChalkColor {
  readonly bgBlack: IColorPair
  readonly bgRed: IColorPair
  readonly bgGreen: IColorPair
  readonly bgYellow: IColorPair
  readonly bgBlue: IColorPair
  readonly bgCyan: IColorPair
  readonly bgMagenta: IColorPair
  readonly bgWhite: IColorPair

  // Alias for `bgBlackBright`.
  readonly bgGray: IColorPair

  // Alias for `bgBlackBright`.
  readonly bgGrey: IColorPair

  readonly bgBlackBright: IColorPair
  readonly bgRedBright: IColorPair
  readonly bgGreenBright: IColorPair
  readonly bgYellowBright: IColorPair
  readonly bgBlueBright: IColorPair
  readonly bgCyanBright: IColorPair
  readonly bgMagentaBright: IColorPair
  readonly bgWhiteBright: IColorPair
}

export interface IChalkStyler {
  readonly open: string
  readonly close: string
  readonly openAll: string
  readonly closeAll: string
  readonly parent: Readonly<IChalkStyler> | undefined
}

export type IChalkColorName = keyof IChalkColor
export type IModifyExcludeColorName = Exclude<keyof IModifier, IChalkColorName>
export type IForegroundColorExcludeColorName = Exclude<keyof IForegroundColor, IChalkColorName>
export type IBackgroundColorExcludeColorName = Exclude<keyof IBackgroundColor, IChalkColorName>
export type IStyleName =
  | IModifyExcludeColorName
  | IForegroundColorExcludeColorName
  | IBackgroundColorExcludeColorName

export interface IAnsiStyles extends IModifier, IForegroundColor, IBackgroundColor {
  modifier: IModifier
  color: IForegroundColor
  bgColor: IBackgroundColor
  codes: ReadonlyMap<number, number>
}

export interface IBasicStyles {
  readonly level: 0 | 1 | 2 | 3
  readonly styler: IChalkStyler | undefined
  readonly isEmpty: boolean
  readonly visible: IChalkBuilder
  rgb(r: number, g: number, b: number): IChalkBuilder
  hex(hex: string): IChalkBuilder
  ansi256(code: number): IChalkBuilder
  bgRgb(r: number, g: number, b: number): IChalkBuilder
  bgHex(hex: string): IChalkBuilder
  bgAnsi256(code: number): IChalkBuilder
}

export type IChalkStyles = {
  readonly [key in IStyleName]: IChalkBuilder
} & IBasicStyles

export interface IChalkBuilder extends IChalkStyles {
  // Apply colors
  (...texts: string[]): string
}

export interface IChalk extends IChalkStyles {}
