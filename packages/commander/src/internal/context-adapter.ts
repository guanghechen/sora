import type {
  ICommandActionParams,
  ICommandContext,
  ICommandControlScanResult,
  ICommandInputSources,
  ICommandParseResult,
  ICommandPresetResult,
} from '../command/types'

export interface IKernelPresetResult extends ICommandPresetResult {
  sources: ICommandInputSources
}

export interface ICommandContextAdapter {
  applyControlScan(
    ctx: ICommandContext,
    controlScanResult: ICommandControlScanResult,
  ): ICommandContext
  applyPresetResult(ctx: ICommandContext, presetResult: IKernelPresetResult): ICommandContext
  toActionParams(parseResult: ICommandParseResult): ICommandActionParams
}

export class CommandContextAdapter implements ICommandContextAdapter {
  public applyControlScan(
    ctx: ICommandContext,
    controlScanResult: ICommandControlScanResult,
  ): ICommandContext {
    return {
      ...ctx,
      controls: controlScanResult.controls,
      sources: {
        ...ctx.sources,
        user: {
          ...ctx.sources.user,
          argv: [...controlScanResult.remaining],
        },
      },
    }
  }

  public applyPresetResult(
    ctx: ICommandContext,
    presetResult: IKernelPresetResult,
  ): ICommandContext {
    return {
      ...ctx,
      sources: presetResult.sources,
      envs: presetResult.envs,
    }
  }

  public toActionParams(parseResult: ICommandParseResult): ICommandActionParams {
    return {
      ctx: parseResult.ctx,
      builtin: parseResult.builtin,
      opts: parseResult.opts,
      args: parseResult.args,
      rawArgs: parseResult.rawArgs,
    }
  }
}
