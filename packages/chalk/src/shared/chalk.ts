import { ColorSupportLevelEnum } from '@guanghechen/internal'
import { Styles } from './styles'

export class Chalk extends Styles {
  private constructor(level: ColorSupportLevelEnum) {
    super(level, undefined, false)
  }

  static #instanceMap: Map<ColorSupportLevelEnum, Chalk> = new Map()
  public static create(level: ColorSupportLevelEnum): Chalk {
    if (
      !Number.isInteger(level) ||
      level < ColorSupportLevelEnum.DISABLED ||
      level > ColorSupportLevelEnum.True16m
    ) {
      throw new Error(
        `The \`level\` option should be an integer from ${ColorSupportLevelEnum.DISABLED} to ${ColorSupportLevelEnum.True16m}`,
      )
    }

    let instance: Chalk | undefined = this.#instanceMap.get(level)
    if (instance === undefined) {
      instance = new Chalk(level)
      this.#instanceMap.set(level, instance)
    }
    return instance
  }
}
