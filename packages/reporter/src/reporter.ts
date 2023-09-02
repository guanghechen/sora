import { LevelOrdinalMap, ReporterLevelEnum } from '@guanghechen/constant'
import type { IReporter } from '@guanghechen/types'
import dayjs from 'dayjs'
import { parseOptionsFromArgs } from './args'
import { normalizeString } from './format'
import type { ILevelStyleMap } from './level'
import { defaultLevelStyleMap } from './level'

export interface IReporterFlights {
  readonly date: boolean
  readonly title: boolean
  readonly inline: boolean
  readonly colorful: boolean
}

export interface IReporterOptions {
  baseName?: string | null
  level?: ReporterLevelEnum | null
  flights?: Partial<IReporterFlights>
  placeholderRegex?: RegExp
}

const write =
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

  constructor(options_: IReporterOptions = {}, args: string[] = getDefaultArgs()) {
    const options: IReporterOptions = {
      ...options_,
      ...parseOptionsFromArgs(args),
    }

    this.level = options.level ?? ReporterLevelEnum.INFO
    this.levelStyleMap = defaultLevelStyleMap
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

  public setDivisionName(divisionName: string | null): void {
    this._divisionName = divisionName ?? this._divisionName
  }

  public debug(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.DEBUG, messageFormat, ...messages)
  }

  public verbose(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.VERBOSE, messageFormat, ...messages)
  }

  public info(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.INFO, messageFormat, ...messages)
  }

  public warn(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.WARN, messageFormat, ...messages)
  }

  public error(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.ERROR, messageFormat, ...messages)
  }

  public fatal(messageFormat: string | unknown, ...messages: unknown[]): void {
    this.log(ReporterLevelEnum.FATAL, messageFormat, ...messages)
  }

  // write a log record.
  public log(
    level: ReporterLevelEnum,
    messageFormat: string | unknown,
    ...messages: unknown[]
  ): void {
    if (!level || LevelOrdinalMap[level] < LevelOrdinalMap[this.level]) return
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

    this.write(this.format(level, header, message))
  }

  // format a log record.
  protected format(level: ReporterLevelEnum, header: string, message: string): string {
    const content: string = this.formatContent(level, message)
    return header.length > 0 ? header + ' ' + content : content
  }

  // format a log record's header.
  protected formatHeader(level: ReporterLevelEnum, date: Date): string {
    const dateText: string = this.flights.date
      ? this.formatContent(level, dayjs(date).format('YYYY-MM-DD HH:mm:ss'))
      : ''

    const levelStyle = this.levelStyleMap[level]
    let levelText = levelStyle.title
    if (this.flights.colorful) {
      levelText = levelStyle.labelChalk.fg(levelText)
      if (levelStyle.labelChalk.bg != null) levelText = levelStyle.labelChalk.bg(levelText)
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
      if (levelStyle.contentChalk.bg != null) {
        text = levelStyle.contentChalk.bg(text)
      }
    }
    return text
  }

  // format a log record part message according its type.
  public formatSingleMessage(message: unknown): string {
    return normalizeString(message ? message : String(message), this.flights.inline)
  }

  protected write(text: string): void {
    write(text)
  }
}
