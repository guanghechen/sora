import type { IReporterFlights } from '@guanghechen/reporter.types'
import type { Mutable } from '@guanghechen/types'
import { resolveLevel } from './level'
import type { IReporterOptions } from './reporter'

interface ICommanderOptions {
  logLevel?: string
  logBaseName?: string
  logFlight?: string[]
}

export function parseOptionsFromArgs(args: string[]): IReporterOptions {
  const options: ICommanderOptions = { logFlight: [] }
  const regex = /^--log-([\w]+)(?:=([\s\S]+))?/
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i]
    const match = regex.exec(arg)
    if (!match) continue
    let [, key, val] = match

    if (typeof val !== 'string') {
      if (i + 1 < args.length) {
        const nextArg = args[i + 1]

        /* c8 ignore start */
        if (/^-/.test(nextArg)) continue
        /* c8 ignore stop */

        i += 1
        val = nextArg
      }
    }

    key = key.toLowerCase()
    switch (key) {
      case 'flight':
        options.logFlight!.push(val)
        break
      case 'level':
        options.logLevel = val
        break
      case 'basename':
        options.logBaseName = val
        break
    }
  }

  return parseOptionsFromCommander(options)
}

export function parseOptionsFromCommander(commanderOptions: ICommanderOptions): IReporterOptions {
  const flights: Partial<Mutable<IReporterFlights>> = {}
  const options: IReporterOptions = { flights }

  // Resolve log level
  if (typeof commanderOptions.logLevel === 'string') {
    const logLevel = commanderOptions.logLevel.trim().toLowerCase()
    const level = resolveLevel(logLevel)
    if (level) options.level = level
  }

  // Resolve log name
  if (typeof commanderOptions.logBaseName === 'string') {
    options.baseName = commanderOptions.logBaseName.trim()
  }

  // Resolve log flights
  if (commanderOptions.logFlight) {
    const logFlights: string[] = [commanderOptions.logFlight]
      .flat()
      .filter(Boolean)
      .map(flight => flight.split(/\s*,\s*/g))
      .flat()
      .map(flight => flight.trim().toLowerCase())
      .filter(Boolean)
    for (let flight of logFlights) {
      let negative = false
      if (/^no-/.test(flight)) {
        negative = true
        flight = flight.slice(3)
      }
      flight = flight.toLowerCase()
      switch (flight) {
        case 'inline':
          flights.inline = !negative
          break
        case 'date':
          flights.date = !negative
          break
        case 'title':
          flights.title = !negative
          break
        case 'colorful':
          flights.colorful = !negative
          break
      }
    }
  }
  return options
}
