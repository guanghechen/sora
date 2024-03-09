export class Debouncer {
  protected readonly _delay: number
  protected _timer: ReturnType<typeof setTimeout> | undefined
  protected _callback: () => void

  constructor(delay: number = 100) {
    this._delay = delay
    this._timer = undefined
    this._callback = (): void => {
      this._timer = undefined
    }
  }

  public cancel(): void {
    if (this._timer !== undefined) {
      clearTimeout(this._timer)
      this._timer = undefined
    }
  }

  public flush(): void {
    if (this._timer !== undefined) {
      clearTimeout(this._timer)
      this._callback()
    }
  }

  public run(callback: () => void): void {
    this._callback = (): void => {
      this._timer = undefined
      callback()
    }

    if (this._timer !== undefined) clearTimeout(this._timer)
    this._timer = setTimeout(this._callback, this._delay)
  }
}
