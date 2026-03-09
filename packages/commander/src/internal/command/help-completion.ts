import type {
  ICommandArgumentConfig,
  ICommandOptionConfig,
  ICompletionArgumentMeta,
  ICompletionMeta,
  ICompletionOptionMeta,
  ISubcommandEntry,
} from '../../command/types'
import type { IHelpRendererSubcommand } from '../help/command-help-renderer'

export function buildHelpSubcommands<TCommand>(params: {
  entries: Array<ISubcommandEntry<TCommand>>
  getDescription: (command: TCommand) => string
}): IHelpRendererSubcommand[] {
  const { entries, getDescription } = params
  return entries.map(entry => ({
    name: entry.name,
    aliases: entry.aliases,
    desc: getDescription(entry.command),
  }))
}

export function buildCompletionMeta<TCommand>(params: {
  name: string
  desc: string
  mergedOptions: ICommandOptionConfig[]
  arguments_: ICommandArgumentConfig[]
  supportsBuiltinVersion: boolean
  builtinHelpOption: ICommandOptionConfig
  builtinVersionOption: ICommandOptionConfig
  subcommands: Array<ISubcommandEntry<TCommand>>
  resolveSubcommandMeta: (command: TCommand) => ICompletionMeta
}): ICompletionMeta {
  const {
    name,
    desc,
    mergedOptions,
    arguments_,
    supportsBuiltinVersion,
    builtinHelpOption,
    builtinVersionOption,
    subcommands,
    resolveSubcommandMeta,
  } = params

  const optionMap = new Map<string, ICommandOptionConfig>()
  for (const option of mergedOptions) {
    optionMap.set(option.long, option)
  }
  optionMap.set('help', builtinHelpOption)
  if (supportsBuiltinVersion) {
    optionMap.set('version', builtinVersionOption)
  }

  const options: ICompletionOptionMeta[] = Array.from(optionMap.values()).map(option => ({
    long: option.long,
    short: option.short,
    desc: option.desc,
    type: option.type,
    args: option.args,
    choices: option.choices?.map(choice => String(choice)),
  }))

  const argumentsMeta: ICompletionArgumentMeta[] = arguments_.map(argument => ({
    name: argument.name,
    kind: argument.kind,
    type: argument.type,
    choices:
      argument.type === 'choice' ? argument.choices?.map(choice => String(choice)) : undefined,
  }))

  return {
    name,
    desc,
    aliases: [],
    options,
    arguments: argumentsMeta,
    subcommands: subcommands.map(entry => {
      const subMeta = resolveSubcommandMeta(entry.command)
      return {
        ...subMeta,
        name: entry.name,
        aliases: entry.aliases,
      }
    }),
  }
}
