import type {
  CommanderError,
  ICommandBuiltinConfig,
  ICommandBuiltinOptionResolved,
  ICommandBuiltinResolved,
  ICommandIssueScope,
  ICommandOptionConfig,
} from '../../command/types'

export const BUILTIN_HELP_OPTION: ICommandOptionConfig = {
  long: 'help',
  type: 'boolean',
  args: 'none',
  desc: 'Show help information',
}

export const BUILTIN_VERSION_OPTION: ICommandOptionConfig = {
  long: 'version',
  type: 'boolean',
  args: 'none',
  desc: 'Show version number',
}

export function errorKindToIssueScope(kind: CommanderError['kind']): ICommandIssueScope {
  switch (kind) {
    case 'UnknownSubcommand':
      return 'command'
    case 'MissingRequiredArgument':
    case 'TooManyArguments':
    case 'UnexpectedArgument':
      return 'argument'
    case 'ActionFailed':
      return 'action'
    case 'ConfigurationError':
      return 'runtime'
    default:
      return 'option'
  }
}

function createBuiltinOptionState(enabled: boolean): ICommandBuiltinOptionResolved {
  return {
    version: enabled,
    color: enabled,
    devmode: enabled,
    logLevel: enabled,
    silent: enabled,
    logDate: enabled,
    logColorful: enabled,
  }
}

export function normalizeBuiltinConfig(
  builtin: boolean | ICommandBuiltinConfig | undefined,
): ICommandBuiltinResolved {
  const resolved: ICommandBuiltinResolved = {
    option: createBuiltinOptionState(true),
  }

  if (builtin === undefined) {
    return resolved
  }

  if (builtin === true) {
    return {
      option: createBuiltinOptionState(true),
    }
  }

  if (builtin === false) {
    return {
      option: createBuiltinOptionState(false),
    }
  }

  if (builtin.option !== undefined) {
    if (builtin.option === false) {
      resolved.option = createBuiltinOptionState(false)
    } else if (builtin.option === true) {
      resolved.option = createBuiltinOptionState(true)
    } else {
      if (builtin.option.version !== undefined) resolved.option.version = builtin.option.version
      if (builtin.option.color !== undefined) resolved.option.color = builtin.option.color
      if (builtin.option.devmode !== undefined) resolved.option.devmode = builtin.option.devmode
      if (builtin.option.logLevel !== undefined) {
        resolved.option.logLevel = builtin.option.logLevel
      }
      if (builtin.option.silent !== undefined) resolved.option.silent = builtin.option.silent
      if (builtin.option.logDate !== undefined) resolved.option.logDate = builtin.option.logDate
      if (builtin.option.logColorful !== undefined) {
        resolved.option.logColorful = builtin.option.logColorful
      }
    }
  }

  return resolved
}
