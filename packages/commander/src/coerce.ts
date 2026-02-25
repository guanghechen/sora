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

  public static choice<TValue extends string>(
    name: string,
    values: ReadonlyArray<TValue>,
    errorMessage?: string,
  ): (rawValue: string) => TValue {
    return (rawValue: string): TValue => {
      if (values.includes(rawValue as TValue)) {
        return rawValue as TValue
      }

      throw new Error(
        errorMessage ?? `${name} is expected as one of [${values.join(', ')}], but got ${rawValue}`,
      )
    }
  }

  public static integer(name: string, errorMessage?: string): (rawValue: string) => number {
    return this.create(name, 'an integer', value => Number.isInteger(value), errorMessage)
  }

  public static number(name: string, errorMessage?: string): (rawValue: string) => number {
    return this.create(name, 'a finite number', value => Number.isFinite(value), errorMessage)
  }

  public static port(name: string, errorMessage?: string): (rawValue: string) => number {
    return this.create(
      name,
      'a valid port number (0-65535)',
      value => Number.isInteger(value) && value >= 0 && value <= 65535,
      errorMessage,
    )
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
