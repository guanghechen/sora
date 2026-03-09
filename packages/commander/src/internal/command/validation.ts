import { CommanderError } from '../../command/types'
import type {
  ICommandArgumentConfig,
  ICommandExample,
  ICommandOptionConfig,
} from '../../command/types'

export function validateOptionConfig<T>(params: {
  opt: ICommandOptionConfig<T>
  commandPath: string
}): void {
  const { opt, commandPath } = params

  if (
    opt.long === 'help' ||
    opt.long === 'version' ||
    opt.long === 'devmode' ||
    opt.long === 'logLevel'
  ) {
    throw new CommanderError(
      'ConfigurationError',
      `option long name "${opt.long}" is reserved`,
      commandPath,
    )
  }

  if (opt.type === 'boolean' && opt.args !== 'none') {
    throw new CommanderError(
      'ConfigurationError',
      `boolean option "--${opt.long}" must have args: 'none'`,
      commandPath,
    )
  }
  if ((opt.type === 'string' || opt.type === 'number') && opt.args === 'none') {
    throw new CommanderError(
      'ConfigurationError',
      `${opt.type} option "--${opt.long}" must have args: 'required', 'optional', or 'variadic'`,
      commandPath,
    )
  }
  if (opt.type === 'number' && opt.args === 'optional') {
    throw new CommanderError(
      'ConfigurationError',
      `number option "--${opt.long}" does not support args: 'optional'`,
      commandPath,
    )
  }

  if (opt.long.startsWith('no')) {
    throw new CommanderError(
      'ConfigurationError',
      `option long name cannot start with "no": "${opt.long}"`,
      commandPath,
    )
  }

  if (!/^[a-z][a-zA-Z0-9]*$/.test(opt.long)) {
    throw new CommanderError(
      'ConfigurationError',
      `option long name must be camelCase: "${opt.long}"`,
      commandPath,
    )
  }

  if (opt.short !== undefined && opt.short.length !== 1) {
    throw new CommanderError(
      'ConfigurationError',
      `option short name must be a single character: "${opt.short}"`,
      commandPath,
    )
  }

  if (opt.required && opt.default !== undefined) {
    throw new CommanderError(
      'ConfigurationError',
      `option "--${opt.long}" cannot be both required and have a default value`,
      commandPath,
    )
  }

  if (opt.type === 'boolean' && opt.required) {
    throw new CommanderError(
      'ConfigurationError',
      `boolean option "--${opt.long}" cannot be required`,
      commandPath,
    )
  }

  if (opt.required && opt.args !== 'required') {
    throw new CommanderError(
      'ConfigurationError',
      `required option "--${opt.long}" must use args: 'required'`,
      commandPath,
    )
  }
}

export function checkOptionUniqueness<T>(params: {
  opt: ICommandOptionConfig<T>
  options: ICommandOptionConfig[]
  commandPath: string
}): void {
  const { opt, options, commandPath } = params

  if (options.some(o => o.long === opt.long)) {
    throw new CommanderError(
      'OptionConflict',
      `option "--${opt.long}" is already defined`,
      commandPath,
    )
  }

  if (opt.short && options.some(o => o.short === opt.short)) {
    throw new CommanderError(
      'OptionConflict',
      `short option "-${opt.short}" is already defined`,
      commandPath,
    )
  }
}

export function validateArgumentConfig(params: {
  arg: ICommandArgumentConfig
  arguments_: ICommandArgumentConfig[]
  commandPath: string
}): void {
  const { arg, arguments_, commandPath } = params

  if (
    arg.kind !== 'required' &&
    arg.kind !== 'optional' &&
    arg.kind !== 'variadic' &&
    arg.kind !== 'some'
  ) {
    throw new CommanderError(
      'ConfigurationError',
      `argument "${arg.name}" must specify a valid kind`,
      commandPath,
    )
  }

  if (arg.type !== 'string' && arg.type !== 'choice') {
    throw new CommanderError(
      'ConfigurationError',
      `argument "${arg.name}" must specify a valid type`,
      commandPath,
    )
  }

  if (arg.default !== undefined && arg.kind !== 'optional') {
    throw new CommanderError(
      'ConfigurationError',
      `only optional argument "${arg.name}" can have a default value`,
      commandPath,
    )
  }

  if (arg.type === 'string' && arg.choices !== undefined) {
    throw new CommanderError(
      'ConfigurationError',
      `argument "${arg.name}" of type "string" cannot declare choices`,
      commandPath,
    )
  }

  if (arg.type === 'choice') {
    if (!Array.isArray(arg.choices) || arg.choices.length === 0) {
      throw new CommanderError(
        'ConfigurationError',
        `argument "${arg.name}" of type "choice" must declare a non-empty choices array`,
        commandPath,
      )
    }

    if (arg.choices.some(choice => typeof choice !== 'string')) {
      throw new CommanderError(
        'ConfigurationError',
        `argument "${arg.name}" choices must be string[]`,
        commandPath,
      )
    }
  }

  if (arg.default !== undefined) {
    validateArgumentDefaultValue({ arg, commandPath })
  }

  if (arg.kind === 'variadic' || arg.kind === 'some') {
    if (arguments_.some(a => a.kind === 'variadic' || a.kind === 'some')) {
      throw new CommanderError(
        'ConfigurationError',
        'only one variadic/some argument is allowed',
        commandPath,
      )
    }
  }

  if (arguments_.length > 0) {
    const last = arguments_[arguments_.length - 1]
    if (last.kind === 'variadic' || last.kind === 'some') {
      throw new CommanderError(
        'ConfigurationError',
        'variadic/some argument must be the last argument',
        commandPath,
      )
    }
  }

  if (arg.kind === 'required') {
    const hasOptional = arguments_.some(
      a => a.kind === 'optional' || a.kind === 'variadic' || a.kind === 'some',
    )
    if (hasOptional) {
      throw new CommanderError(
        'ConfigurationError',
        `required argument "${arg.name}" cannot come after optional/variadic/some arguments`,
        commandPath,
      )
    }
  }
}

function validateArgumentDefaultValue(params: {
  arg: ICommandArgumentConfig
  commandPath: string
}): void {
  const { arg, commandPath } = params

  if (typeof arg.default !== 'string') {
    throw new CommanderError(
      'ConfigurationError',
      `default value for argument "${arg.name}" must match type "${arg.type}"`,
      commandPath,
    )
  }

  if (arg.type === 'choice') {
    const choices = arg.choices ?? []
    if (!choices.includes(arg.default)) {
      throw new CommanderError(
        'ConfigurationError',
        `default value for argument "${arg.name}" must be one of declared choices`,
        commandPath,
      )
    }
  }
}

export function normalizeExample(params: {
  example: ICommandExample
  commandPath: string
}): ICommandExample {
  const { example, commandPath } = params
  const title = example.title.trim()
  const usage = example.usage.trim()
  const desc = example.desc.trim()

  if (!title) {
    throw new CommanderError('ConfigurationError', 'example title cannot be empty', commandPath)
  }
  if (!usage) {
    throw new CommanderError('ConfigurationError', 'example usage cannot be empty', commandPath)
  }
  if (!desc) {
    throw new CommanderError(
      'ConfigurationError',
      'example description cannot be empty',
      commandPath,
    )
  }

  return { title, usage, desc }
}
