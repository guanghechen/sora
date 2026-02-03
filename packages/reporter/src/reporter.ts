import type { IChalk } from '@guanghechen/chalk.types'
import type { IReporter, IReporterFlights } from '@guanghechen/reporter.types'
import { ReporterLevelEnum } from '@guanghechen/reporter.types'
import { parseOptionsFromArgs } from './args'
import { formatDate, normalizeString } from './format'
import type { ILevelStyleMap } from './level'

type Mutable<T extends object> = { -readonly [P in keyof T]: T[P] }

export interface IReporterOptions {
  baseName?: string
  level?: ReporterLevelEnum
  flights?: Partial<IReporterFlights>
  placeholderRegex?: RegExp
}

const defaultWrite =
  typeof process !== 'undefined'
    ? (text: string): void => {
        process.stdout.write(text)
      }
    : (text: string): void => {
        console.log(text)
      }
const getDefaultArgs = (): string[] => {
  if (typeof process === 'undefined') return []
  return process.argv
}

export class Reporter implements IReporter {
  public readonly level: ReporterLevelEnum
  public readonly levelStyleMap: ILevelStyleMap
  public readonly flights: Readonly<IReporterFlights>
  public readonly placeholderRegex: RegExp
  protected _baseName: string
  protected _divisionName: string

  constructor(chalk: IChalk, options_: IReporterOptions = {}, args_: string[] = getDefaultArgs()) {
    const argOptions: IReporterOptions = parseOptionsFromArgs(args_)
    const options: IReporterOptions = {
      ...options_,
      ...argOptions,
      flights: {
        ...options_.flights,
        ...argOptions.flights,
      },
    }

    this.level = options.level ?? ReporterLevelEnum.INFO
    this.levelStyleMap = Object.freeze({
      [ReporterLevelEnum.DEBUG]: {
        title: 'debug',
        labelChalk: { fg: chalk.grey },
        contentChalk: { fg: chalk.grey },
      },
      [ReporterLevelEnum.VERBOSE]: {
        title: 'verb ',
        labelChalk: { fg: chalk.cyan },
        contentChalk: { fg: chalk.cyan },
      },
      [ReporterLevelEnum.INFO]: {
        title: 'info ',
        labelChalk: { fg: chalk.green },
        contentChalk: { fg: chalk.green },
      },
      [ReporterLevelEnum.WARN]: {
        title: 'warn ',
        labelChalk: { fg: chalk.yellow },
        contentChalk: { fg: chalk.yellow },
      },
      [ReporterLevelEnum.ERROR]: {
        title: 'error',
        labelChalk: { fg: chalk.red },
        contentChalk: { fg: chalk.red },
      },
      [ReporterLevelEnum.FATAL]: {
        title: 'fatal',
        labelChalk: { fg: chalk.black, bg: chalk.bgRed },
        contentChalk: { fg: chalk.redBright },
      },
    })

    this.flights = Object.freeze({
      date: options.flights?.date ?? false,
      title: options.flights?.title ?? true,
      inline: options.flights?.inline ?? true,
      colorful: options.flights?.colorful ?? true,
    })
    this.placeholderRegex = options.placeholderRegex ?? /(?<!\\)\{\}/g
    this._baseName = options.baseName ?? ''
    this._divisionName = ''
  }

  public get name(): string {
    if (this._baseName === '') return this._divisionName ?? ''
    if (this._divisionName === '') return this._baseName
    return this._baseName + '#' + this._divisionName
  }

  public setDivisionName(divisionName: string): void {
    this._divisionName = divisionName
  }

  public setLevel(level: ReporterLevelEnum | null | undefined): void {
    if (level == null) return
    const that = this as Mutable<this>
    that.level = level
  }

  public write(text: string): void {
    defaultWrite(text)
  }

  public debug(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.DEBUG, messageFormat, messages)
  }

  public verbose(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.VERBOSE, messageFormat, messages)
  }

  public info(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.INFO, messageFormat, messages)
  }

  public warn(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.WARN, messageFormat, messages)
  }

  public error(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.ERROR, messageFormat, messages)
  }

  public fatal(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.FATAL, messageFormat, messages)
  }

  public log(level: ReporterLevelEnum, messageFormat: string | unknown, messages: unknown[]): void {
    const text: string | undefined = this.format(level, messageFormat, messages)
    if (text !== undefined) this.write(text)
  }

  public format(
    level: ReporterLevelEnum,
    messageFormat: string | unknown,
    messages: unknown[],
  ): string | undefined {
    if (!level || level < this.level) return
    const header = this.formatHeader(level, new Date())

    let newline = false
    const formatPattern: string = typeof messageFormat === 'string' ? messageFormat : ''
    const items: string[] = (
      typeof messageFormat === 'string' ? messages : [messageFormat, ...messages]
    ).map(msg => {
      const text = this.formatSingleMessage(msg)
      if (text.endsWith('\n')) {
        newline = true
        return '\n' + text
      }
      return text
    })

    let unpairedIdx = 0
    let message =
      items.length > 0
        ? formatPattern.replace(this.placeholderRegex, m => {
            const value = items[unpairedIdx]
            unpairedIdx += 1
            return value === undefined ? m : value
          })
        : formatPattern
    if (unpairedIdx < items.length) message += ' ' + items.slice(unpairedIdx).join(' ')
    if (!newline && !message.endsWith('\n')) message += '\n'

    const content: string = this.formatContent(level, message)
    return header.length > 0 ? header + ' ' + content : content
  }

  // format a log record's header.
  protected formatHeader(level: ReporterLevelEnum, date: Date): string {
    const dateText: string = this.flights.date ? this.formatContent(level, formatDate(date)) : ''

    const levelStyle = this.levelStyleMap[level]
    let levelText = levelStyle.title
    if (this.flights.colorful) {
      levelText = levelStyle.labelChalk.fg(levelText)
      if (levelStyle.labelChalk.bg) levelText = levelStyle.labelChalk.bg(levelText)
    }

    const titleText: string = this.flights.title
      ? this.formatContent(level, '[' + this.name + ']')
      : ''

    let result = ''
    if (dateText) result += dateText + ' '
    result += levelText
    if (titleText) result += ' ' + titleText
    return result
  }

  protected formatContent(level: ReporterLevelEnum, message: string): string {
    let text: string = message
    if (this.flights.colorful) {
      const levelStyle = this.levelStyleMap[level]
      text = levelStyle.contentChalk.fg(text)
      if (levelStyle.contentChalk.bg) text = levelStyle.contentChalk.bg(text)
    }
    return text
  }

  // format a log record part message according its type.
  public formatSingleMessage(message: unknown): string {
    return normalizeString(message ? message : String(message), this.flights.inline)
  }
}
