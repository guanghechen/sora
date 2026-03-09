import type { IReporter } from '@guanghechen/reporter'
import { CommanderError } from '../types'
import type {
  ICommandArgvSegment,
  ICommandContext,
  ICommandControlScanResult,
  ICommandIssueScope,
  ICommandParseResult,
  ICommandResolveResult,
  ICommandRouteResult,
  ICommandRunParams,
  ICommandToken,
  ICommandTokenizeResult,
} from '../types'
import type { ICommandContextAdapter, IKernelPresetResult } from './context-adapter'
import type { ICommandDiagnosticsEngine } from './diagnostics-engine'

export type ICommandExecutionMode = 'run' | 'parse'

export type ICommandExecutionTermination =
  | {
      kind: 'help'
      targetCommandPath: string
    }
  | {
      kind: 'version'
      targetCommandPath: string
      version: string
    }

export type IExecutionOutcome =
  | {
      kind: 'parsed'
      parseResult: ICommandParseResult
    }
  | {
      kind: 'terminated'
      termination: ICommandExecutionTermination
    }
  | {
      kind: 'failed'
      error: CommanderError
    }

export interface ICommandKernelPort<TCommand, TOptionPolicy> {
  route(argv: string[]): ICommandRouteResult<TCommand>
  createContext(params: {
    chain: TCommand[]
    cmds: string[]
    envs: Record<string, string | undefined>
    reporter?: IReporter
  }): ICommandContext
  controlScan(tailArgv: string[], leafCommand: TCommand): ICommandControlScanResult
  controlRun(
    leafCommand: TCommand,
    controlScanResult: ICommandControlScanResult,
  ): ICommandExecutionTermination | undefined
  preset(tailArgv: string[], ctx: ICommandContext): Promise<IKernelPresetResult>
  tokenize(segments: ICommandArgvSegment[], commandPath: string): ICommandTokenizeResult
  getCommandPath(command: TCommand): string
  buildOptionPolicyMap(chain: TCommand[]): Map<TCommand, TOptionPolicy>
  resolve(
    chain: TCommand[],
    optionTokens: ICommandToken[],
    optionPolicyMap: Map<TCommand, TOptionPolicy>,
  ): ICommandResolveResult
  parse(
    chain: TCommand[],
    resolveResult: ICommandResolveResult,
    optionPolicyMap: Map<TCommand, TOptionPolicy>,
    ctx: ICommandContext,
    restArgs: string[],
  ): ICommandParseResult
  run(params: {
    leafCommand: TCommand
    parseResult: ICommandParseResult
    presetResult: IKernelPresetResult
    ctx: ICommandContext
  }): Promise<void>
  issueScopeFromErrorKind(kind: CommanderError['kind']): ICommandIssueScope
}

export class CommandKernel<TCommand, TOptionPolicy> {
  readonly #port: ICommandKernelPort<TCommand, TOptionPolicy>
  readonly #diagnostics: ICommandDiagnosticsEngine
  readonly #contextAdapter: ICommandContextAdapter

  constructor(params: {
    port: ICommandKernelPort<TCommand, TOptionPolicy>
    diagnostics: ICommandDiagnosticsEngine
    contextAdapter: ICommandContextAdapter
  }) {
    this.#port = params.port
    this.#diagnostics = params.diagnostics
    this.#contextAdapter = params.contextAdapter
  }

  public async execute(
    params: ICommandRunParams,
    mode: ICommandExecutionMode,
  ): Promise<IExecutionOutcome> {
    const { argv, envs, reporter } = params

    try {
      // 0. ROUTE
      const routeResult = this.#port.route(argv)
      const { chain } = routeResult
      const leafCommand = chain[chain.length - 1]

      let ctx = this.#port.createContext({
        chain,
        cmds: routeResult.cmds,
        envs,
        reporter,
      })

      // 1. CONTROL SCAN
      const controlScanResult = this.#port.controlScan(routeResult.remaining, leafCommand)
      ctx = this.#contextAdapter.applyControlScan(ctx, controlScanResult)

      // 2. control-run (run only)
      if (mode === 'run') {
        const termination = this.#port.controlRun(leafCommand, controlScanResult)
        if (termination !== undefined) {
          ctx.sources.preset.state = 'skipped'
          return {
            kind: 'terminated',
            termination,
          }
        }
      }

      // 3. PRESET
      let presetResult: IKernelPresetResult
      try {
        presetResult = await this.#port.preset(controlScanResult.remaining, ctx)
      } catch (err) {
        if (err instanceof CommanderError) {
          throw this.#diagnostics.withErrorIssue(err, {
            stage: 'preset',
            scope: this.#port.issueScopeFromErrorKind(err.kind),
          })
        }
        throw err
      }
      ctx = this.#contextAdapter.applyPresetResult(ctx, presetResult)
      const sourceSegments = presetResult.segments

      // 4. TOKENIZE
      let optionTokens: ICommandToken[]
      let restArgs: string[]
      try {
        const tokenizeResult = this.#port.tokenize(
          sourceSegments,
          this.#port.getCommandPath(leafCommand),
        )
        optionTokens = tokenizeResult.optionTokens
        restArgs = tokenizeResult.restArgs
      } catch (err) {
        if (err instanceof CommanderError) {
          const enriched = this.#diagnostics.withErrorIssue(err, {
            stage: 'tokenize',
            scope: this.#port.issueScopeFromErrorKind(err.kind),
          })
          throw this.#diagnostics.withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 5. BUILTIN RESOLVE
      let optionPolicyMap: Map<TCommand, TOptionPolicy>
      try {
        optionPolicyMap = this.#port.buildOptionPolicyMap(chain)
      } catch (err) {
        if (err instanceof CommanderError) {
          const enriched = this.#diagnostics.withErrorIssue(err, {
            stage: 'builtin-resolve',
            scope: this.#port.issueScopeFromErrorKind(err.kind),
          })
          throw this.#diagnostics.withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 6. RESOLVE
      let resolveResult: ICommandResolveResult
      try {
        resolveResult = this.#port.resolve(chain, optionTokens, optionPolicyMap)
      } catch (err) {
        if (err instanceof CommanderError) {
          const enriched = this.#diagnostics.withErrorIssue(err, {
            stage: 'resolve',
            scope: this.#port.issueScopeFromErrorKind(err.kind),
          })
          throw this.#diagnostics.withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 7. PARSE
      let parseResult: ICommandParseResult
      try {
        parseResult = this.#port.parse(chain, resolveResult, optionPolicyMap, ctx, restArgs)
      } catch (err) {
        if (err instanceof CommanderError) {
          const optionConflictSource = this.#diagnostics.resolveOptionConflictSourceAttribution(
            err,
            sourceSegments,
          )
          const optionConflictPreset = this.#diagnostics.resolveOptionConflictPresetAttribution(
            err,
            sourceSegments,
            optionConflictSource,
          )
          const enriched = this.#diagnostics.withErrorIssue(err, {
            stage: 'parse',
            scope: this.#port.issueScopeFromErrorKind(err.kind),
            source: optionConflictSource,
            preset: optionConflictPreset,
          })
          throw this.#diagnostics.withPresetInjectedHint(enriched, sourceSegments)
        }
        throw err
      }

      // 8. RUN (run only)
      if (mode === 'run') {
        try {
          await this.#port.run({
            leafCommand,
            parseResult,
            presetResult,
            ctx,
          })
        } catch (err) {
          if (err instanceof CommanderError) {
            throw this.#diagnostics.withErrorIssue(err, {
              stage: 'run',
              scope: this.#port.issueScopeFromErrorKind(err.kind),
            })
          }
          throw err
        }
      }

      return {
        kind: 'parsed',
        parseResult,
      }
    } catch (err) {
      if (err instanceof CommanderError) {
        return {
          kind: 'failed',
          error: this.#diagnostics.normalizeCommanderError(err, {
            fallbackStage: mode === 'run' ? 'run' : 'parse',
            fallbackScope: this.#port.issueScopeFromErrorKind(err.kind),
          }),
        }
      }
      throw err
    }
  }
}
