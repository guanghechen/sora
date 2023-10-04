import type {
  IAnsiStyles,
  IBackgroundColor,
  IBackgroundColorExcludeColorName,
  IChalkColor,
  IForegroundColor,
  IForegroundColorExcludeColorName,
  IModifier,
  IModifyExcludeColorName,
  IStyleName,
} from '@guanghechen/internal'

type IWrapAnsi16 = (offset?: number) => (code: number) => string
type IWrapAnsi256 = (offset?: number) => (code: number) => string
type IWrapAnsi16m = (offset?: number) => (red: number, green: number, blue: number) => string

const wrapAnsi16: IWrapAnsi16 =
  (offset = 0) =>
  code =>
    `\u001B[${code + offset}m`

const wrapAnsi256: IWrapAnsi256 =
  (offset = 0) =>
  code =>
    `\u001B[${38 + offset};5;${code}m`

const wrapAnsi16m: IWrapAnsi16m =
  (offset = 0) =>
  (red, green, blue) =>
    `\u001B[${38 + offset};2;${red};${green};${blue}m`

interface IRawStyles {
  modifier: Record<Exclude<keyof IModifier, keyof IChalkColor>, [open: number, close: number]>
  color: Record<Exclude<keyof IForegroundColor, keyof IChalkColor>, [open: number, close: number]>
  bgColor: Record<Exclude<keyof IBackgroundColor, keyof IChalkColor>, [open: number, close: number]>
}

const rawStyles: IRawStyles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29],
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],

    // Bright color
    blackBright: [90, 39],
    gray: [90, 39], // Alias of `blackBright`
    grey: [90, 39], // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39],
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],

    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49], // Alias of `bgBlackBright`
    bgGrey: [100, 49], // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49],
  },
}

const colorKeys: Array<keyof IChalkColor> = ['close', 'ansi', 'ansi256', 'ansi16m']
export const modifierNames: IModifyExcludeColorName[] = Object.keys(rawStyles.modifier).filter(
  key => !colorKeys.includes(key as keyof IChalkColor),
) as IModifyExcludeColorName[]
export const foregroundColorNames: IForegroundColorExcludeColorName[] = Object.keys(
  rawStyles.color,
).filter(key => !colorKeys.includes(key as keyof IChalkColor)) as IForegroundColorExcludeColorName[]
export const backgroundColorNames: IBackgroundColorExcludeColorName[] = Object.keys(
  rawStyles.bgColor,
).filter(key => !colorKeys.includes(key as keyof IChalkColor)) as IBackgroundColorExcludeColorName[]
export const colorNames: Array<
  IForegroundColorExcludeColorName | IBackgroundColorExcludeColorName
> = [...foregroundColorNames, ...backgroundColorNames]

function assembleStyles(): IAnsiStyles {
  const codes = new Map<number, number>()
  const styles: { -readonly [key in keyof IAnsiStyles]: IAnsiStyles[key] } =
    {} as unknown as IAnsiStyles

  for (const [groupName, group] of Object.entries(rawStyles)) {
    for (const [styleName, style] of Object.entries(group)) {
      const [open, close] = style as [open: number, close: number]
      styles[styleName as IStyleName] = {
        open: `\u001B[${open}m`,
        close: `\u001B[${close}m`,
      }

      group[styleName] = styles[styleName as IStyleName]
      codes.set(open, close)
    }

    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false,
    })
  }

  Object.defineProperty(styles, 'codes', {
    value: codes,
    enumerable: false,
  })
  ;(styles.color.close as string) = '\u001B[39m'
  ;(styles.bgColor.close as string) = '\u001B[49m'

  styles.color.ansi = wrapAnsi16()
  styles.color.ansi256 = wrapAnsi256()
  styles.color.ansi16m = wrapAnsi16m()

  const ANSI_BACKGROUND_OFFSET = 10
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET)
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET)
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET)
  return styles as IAnsiStyles
}

export const ansiStyles: IAnsiStyles = assembleStyles()
