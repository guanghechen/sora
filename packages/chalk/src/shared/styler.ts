import type { IChalkStyler } from '@guanghechen/chalk.types'

export class Styler implements IChalkStyler {
  public readonly open: string
  public readonly close: string
  public readonly openAll: string
  public readonly closeAll: string
  public readonly parent: Readonly<Styler> | undefined

  constructor(open: string, close: string, parent: Readonly<Styler> | undefined) {
    if (parent === undefined) {
      this.openAll = open
      this.closeAll = close
    } else {
      this.openAll = parent.openAll + open
      this.closeAll = close + parent.closeAll
    }

    this.open = open
    this.close = close
    this.parent = parent
  }
}
