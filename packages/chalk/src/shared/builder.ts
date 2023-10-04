import { ColorSupportLevelEnum } from '@guanghechen/internal'
import type { IChalkBuilder, IChalkStyler, IChalkStyles } from '@guanghechen/internal'
import { stringEncaseCRLFWithFirstIndex } from './util/string'

export function createBuilder(generator: IChalkStyles): IChalkBuilder {
  const t: IChalkBuilder = builder as unknown as IChalkBuilder

  // We alter the prototype because we must return a function, but there is
  // no way to create a function with a different prototype
  Object.setPrototypeOf(t, generator)
  return t

  function builder(...texts: string[]): string {
    let text: string = texts.join(' ')
    if (generator.level <= ColorSupportLevelEnum.DISABLED || !text) {
      return generator.isEmpty ? '' : text
    }

    let styler: IChalkStyler | undefined = generator.styler
    if (styler === undefined) return text

    const { openAll, closeAll } = styler
    if (text.includes('\u001B')) {
      while (styler !== undefined) {
        // Replace any instances already present with a re-opening code
        // otherwise only the part of the string until said closing code
        // will be colored, and the rest will simply be 'plain'.
        text = text.replaceAll(styler.close, styler.open)
        styler = styler.parent
      }
    }

    // We can move both next actions out of loop, because remaining actions in loop won't have
    // any/visible effect on parts we add here. Close the styling before a linebreak and reopen
    // after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
    const lfIndex = text.indexOf('\n')
    if (lfIndex > -1) text = stringEncaseCRLFWithFirstIndex(text, closeAll, openAll, lfIndex)

    return openAll + text + closeAll
  }
}
