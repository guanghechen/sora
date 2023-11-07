import type { IConfig, IConfigKeeper } from '@guanghechen/config.types'
import type { IBaseConfigKeeperProps } from './base'
import { BaseConfigKeeper } from './base'

export interface IJsonConfigKeeperProps extends IBaseConfigKeeperProps {}

export abstract class JsonConfigKeeper<Instance, Data>
  extends BaseConfigKeeper<Instance, Data>
  implements IConfigKeeper<Instance>
{
  protected override stringify(data: Data): string {
    return JSON.stringify(data)
  }

  protected override async encode(config: IConfig<Data>): Promise<string> {
    return JSON.stringify(config, null, 2)
  }

  protected override async decode(stringifiedConfig: string): Promise<IConfig<Data>> {
    return JSON.parse(stringifiedConfig)
  }
}

export class PlainJsonConfigKeeper<Data>
  extends JsonConfigKeeper<Data, Data>
  implements IConfigKeeper<Data>
{
  public override readonly __version__: string = '2.0.0'
  public override readonly __compatible_version__: string = '~2.0.0'

  protected async serialize(instance: Data): Promise<Data> {
    return instance
  }

  protected async deserialize(data: Data): Promise<Data> {
    return data
  }
}
