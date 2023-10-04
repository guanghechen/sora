import type {
  IChalkBuilder,
  IChalkColor,
  IChalkStyler,
  IChalkStyles,
} from '@guanghechen/chalk.types'
import { ColorSupportLevelEnum } from '@guanghechen/chalk.types'
import {
  ansiStyles,
  backgroundColorNames,
  foregroundColorNames,
  modifierNames,
} from './ansi-styles'
import { createBuilder } from './builder'
import { Styler } from './styler'
import { hex2rgb } from './util/hex'
import { rgb2ansi, rgb2ansi256 } from './util/rgb'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
class Styles_ implements IChalkStyles {
  private readonly _level: ColorSupportLevelEnum
  private readonly _styler: IChalkStyler | undefined
  private readonly _isEmpty: boolean

  constructor(level: ColorSupportLevelEnum, styler: IChalkStyler | undefined, isEmpty: boolean) {
    this._level = level
    this._styler = styler
    this._isEmpty = isEmpty
  }

  public get level(): ColorSupportLevelEnum {
    return this._level
  }

  public get styler(): IChalkStyler | undefined {
    return this._styler
  }

  public get isEmpty(): boolean {
    return this._isEmpty
  }

  public get visible(): IChalkBuilder {
    return this._build(this.styler, true)
  }

  public rgb(r: number, g: number, b: number): IChalkBuilder {
    const ansi: string = this._getAnsiFromRGB(ansiStyles.color, r, g, b)
    const styler: IChalkStyler = new Styler(ansi, ansiStyles.color.close, this.styler)
    return this._build(styler, this.isEmpty)
  }

  public hex(hex: string): IChalkBuilder {
    const ansi: string = this._getAnsiFromHEX(ansiStyles.color, hex)
    const styler: IChalkStyler = new Styler(ansi, ansiStyles.color.close, this.styler)
    return this._build(styler, this.isEmpty)
  }

  public ansi256(code: number): IChalkBuilder {
    const ansi: string = this._getAnsiFromANSI256(ansiStyles.color, code)
    const styler: IChalkStyler = new Styler(ansi, ansiStyles.color.close, this.styler)
    return this._build(styler, this.isEmpty)
  }

  public bgRgb(r: number, g: number, b: number): IChalkBuilder {
    const ansi: string = this._getAnsiFromRGB(ansiStyles.bgColor, r, g, b)
    const styler: IChalkStyler = new Styler(ansi, ansiStyles.bgColor.close, this.styler)
    return this._build(styler, this.isEmpty)
  }

  public bgHex(hex: string): IChalkBuilder {
    const ansi: string = this._getAnsiFromHEX(ansiStyles.bgColor, hex)
    const styler: IChalkStyler = new Styler(ansi, ansiStyles.bgColor.close, this.styler)
    return this._build(styler, this.isEmpty)
  }

  public bgAnsi256(code: number): IChalkBuilder {
    const ansi: string = this._getAnsiFromANSI256(ansiStyles.bgColor, code)
    const styler: IChalkStyler = new Styler(ansi, ansiStyles.bgColor.close, this.styler)
    return this._build(styler, this.isEmpty)
  }

  private _build(styler: IChalkStyler | undefined, isEmpty: boolean): IChalkBuilder {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const child: IChalkStyles = new Styles_(this.level, styler, isEmpty)
    return createBuilder(child)
  }

  private _getAnsiFromRGB(color: IChalkColor, r: number, g: number, b: number): string {
    const level: ColorSupportLevelEnum = this.level
    if (level === ColorSupportLevelEnum.True16m) return color.ansi16m(r, g, b)
    if (level === ColorSupportLevelEnum.ANSI256) return color.ansi256(rgb2ansi256(r, g, b))
    return color.ansi(rgb2ansi(r, g, b))
  }

  private _getAnsiFromHEX(color: IChalkColor, hex: string): string {
    const [r, g, b] = hex2rgb(hex)
    return this._getAnsiFromRGB(color, r, g, b)
  }

  private _getAnsiFromANSI256(color: IChalkColor, code: number): string {
    return color.ansi256(code)
  }
}

const fn = Styles_.prototype as unknown as IChalkStyles
const styleNames = [...modifierNames, ...foregroundColorNames, ...backgroundColorNames]

for (const styleName of styleNames) {
  Object.defineProperty(fn, styleName, {
    get(): IChalkBuilder {
      const pair = ansiStyles[styleName]
      const styler: IChalkStyler = new Styler(pair.open, pair.close, this.styler)
      const child: IChalkStyles = new Styles_(this.level, styler, this.isEmpty) as any
      return createBuilder(child)
    },
  })
}

export const Styles = Styles_ as unknown as IChalkStylesConstructor

interface IChalkStylesConstructor {
  new (
    level: ColorSupportLevelEnum,
    styler: IChalkStyler | undefined,
    isEmpty: boolean,
  ): IChalkStyles
}
