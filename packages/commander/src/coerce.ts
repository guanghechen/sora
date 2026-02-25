/**
 * Pre-defined coerce factory methods for @guanghechen/commander.
 *
 * @module @guanghechen/commander/coerce
 */

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- keep a discoverable static factory namespace.
export class Coerce {
  private constructor() {}

  private static create(
    name: string,
    expectedType: string,
    validator: (value: number) => boolean,
    errorMessage?: string,
  ): (rawValue: string) => number {
    return (rawValue: string): number => {
      const value = Number(rawValue)
      if (!validator(value)) {
        throw new Error(
          errorMessage ?? `${name} is expected as ${expectedType}, but got ${rawValue}`,
        )
      }

      return value
    }
  }

  public static number(name: string, errorMessage?: string): (rawValue: string) => number {
    return this.create(name, 'a finite number', value => Number.isFinite(value), errorMessage)
  }

  public static integer(name: string, errorMessage?: string): (rawValue: string) => number {
    return this.create(name, 'an integer', value => Number.isInteger(value), errorMessage)
  }

  public static positiveInteger(name: string, errorMessage?: string): (rawValue: string) => number {
    return this.create(
      name,
      'a positive integer',
      value => Number.isInteger(value) && value > 0,
      errorMessage,
    )
  }

  public static positiveNumber(name: string, errorMessage?: string): (rawValue: string) => number {
    return this.create(
      name,
      'a positive number',
      value => Number.isFinite(value) && value > 0,
      errorMessage,
    )
  }
}
