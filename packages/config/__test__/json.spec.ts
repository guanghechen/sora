import { bytes2text, text2bytes } from '@guanghechen/byte'
import { emptyDir, isFileSync, mkdirsIfNotExists, rm, writeFile } from '@guanghechen/internal'
import { calcMac } from '@guanghechen/mac'
import { TextFileResource } from '@guanghechen/resource'
import { assertPromiseThrow, locateFixtures } from 'jest.helper'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { IConfigKeeper } from '../src'
import { JsonConfigKeeper, PlainJsonConfigKeeper } from '../src'

describe('JsonConfigKeeper', () => {
  const workspaceDir: string = locateFixtures('__fictitious__.JsonConfigKeeper')

  beforeEach(async () => {
    await emptyDir(workspaceDir)
  })

  afterEach(async () => {
    await rm(workspaceDir)
  })

  describe('customize', () => {
    interface IUser {
      name: string
      friends: Set<string>
      password: Uint8Array
    }

    interface IUserData {
      name: string
      friends: string[]
      password: string
    }

    const alice: IUser = {
      name: 'Alice',
      friends: new Set(['bob', 'tom']),
      password: text2bytes('alice', 'utf8'),
    }

    const bob: IUser = {
      name: 'Bob',
      friends: new Set(['tom']),
      password: text2bytes('bob', 'utf8'),
    }

    const aliceData: IUserData = {
      name: 'Alice',
      friends: ['bob', 'tom'],
      password: '616c696365',
    }

    const bobData: IUserData = {
      name: 'Bob',
      friends: ['tom'],
      password: '626f62',
    }

    class MyJsonConfigKeeper
      extends JsonConfigKeeper<IUser, IUserData>
      implements IConfigKeeper<IUser>
    {
      public override readonly __version__ = '2.1.0'
      public override readonly __compatible_version__ = '^2.0.0'

      protected async serialize(instance: IUser): Promise<IUserData> {
        return {
          name: instance.name,
          friends: Array.from(instance.friends).sort(),
          password: bytes2text(instance.password, 'hex'),
        }
      }
      protected async deserialize(data: IUserData): Promise<IUser> {
        return {
          name: data.name,
          friends: new Set<string>(data.friends),
          password: text2bytes(data.password, 'hex'),
        }
      }
    }

    const configFilepath: string = path.join(workspaceDir, 'MyJsonConfigKeeper/config.json')
    const resource = new TextFileResource({
      strict: true,
      filepath: configFilepath,
      encoding: 'utf8',
    })
    const keeper = new MyJsonConfigKeeper({ resource })

    testJsonConfigKeeper<IUser, IUserData>({
      className: 'MyJsonConfigKeeper',
      keeper,
      configFilepath,
      instance: { alice, bob },
      data: { alice: aliceData, bob: bobData },
    })
  })

  describe('PlainJsonConfigKeeper', () => {
    interface IUser {
      name: string
      gender: 'male' | 'female'
      age: number
    }

    const alice: IUser = {
      name: 'Alice',
      gender: 'female',
      age: 33,
    }
    const bob: IUser = {
      name: 'Bob',
      gender: 'male',
      age: 23,
    }

    const configFilepath: string = path.join(workspaceDir, 'PlainJsonConfigKeeper/config.json')
    const resource = new TextFileResource({
      strict: true,
      filepath: configFilepath,
      encoding: 'utf8',
    })
    const keeper: IConfigKeeper<IUser> = new PlainJsonConfigKeeper({ resource })

    afterEach(async () => {
      await rm(configFilepath)
      await keeper.destroy()
    })

    test('basic', () => {
      expect(keeper.__version__).toEqual('2.0.0')
      expect(keeper.__compatible_version__).toEqual('~2.0.0')
      expect(keeper.data).toEqual(undefined)
      expect(keeper.compatible('2.0.0')).toEqual(true)
      expect(keeper.compatible('2.0.3')).toEqual(true)
      expect(keeper.compatible('2.0.3-alpha.0')).toEqual(true)
      expect(keeper.compatible('2.1.3')).toEqual(false)
      expect(keeper.compatible('2.1.7-alpha.0')).toEqual(false)
      expect(keeper.compatible('0.0.1')).toEqual(false)
      expect(keeper.compatible('1.0.1')).toEqual(false)
      expect(keeper.compatible('3.0.1')).toEqual(false)
      expect(keeper.compatible('3.1.7-alpha.0')).toEqual(false)
    })

    testJsonConfigKeeper<IUser, IUser>({
      className: 'PlainJsonConfigKeeper',
      keeper,
      configFilepath,
      instance: { alice, bob },
      data: { alice, bob },
    })
  })
})

function testJsonConfigKeeper<Instance, Data>(params: {
  className: string
  keeper: IConfigKeeper<Instance>
  configFilepath: string
  instance: { alice: Instance; bob: Instance }
  data: { alice: Data; bob: Data }
}): void {
  const { className, keeper, configFilepath, instance, data } = params
  expect(keeper.constructor.name).toEqual(className)

  afterEach(async () => {
    await rm(configFilepath)
    await keeper.destroy()
  })

  const writeData = async (version: string, data: Data): Promise<void> => {
    const content: string = JSON.stringify(data)
    const mac: string = bytes2text(calcMac([text2bytes(content, 'utf8')], 'sha256'), 'hex')
    await writeFile(
      configFilepath,
      JSON.stringify({ __version__: version, __mac__: mac, data }),
      'utf8',
    )
  }

  test('load', async () => {
    await assertPromiseThrow(() => keeper.load(), `Cannot find file`)
    mkdirsIfNotExists(configFilepath, true)
    await assertPromiseThrow(() => keeper.load(), `Not a file`)
    expect(keeper.data).toEqual(undefined)

    await rm(configFilepath)
    await writeFile(configFilepath, JSON.stringify({ data: data.alice }), 'utf8')
    await assertPromiseThrow(
      () => keeper.load(),
      '[BaseConfigKeeper.load] Bad config, invalid fields',
    )
    expect(keeper.data).toEqual(undefined)

    await writeFile(configFilepath, JSON.stringify({ version: '2.0.0', data: data.alice }), 'utf8')
    await assertPromiseThrow(
      () => keeper.load(),
      '[BaseConfigKeeper.load] Bad config, invalid fields',
    )
    expect(keeper.data).toEqual(undefined)

    await writeFile(configFilepath, 'null', 'utf8')
    await assertPromiseThrow(
      () => keeper.load(),
      '[BaseConfigKeeper.load] Bad config, invalid fields',
    )
    expect(keeper.data).toEqual(undefined)

    await writeData('3.2.3', data.alice)
    await assertPromiseThrow(
      () => keeper.load(),
      `[BaseConfigKeeper.load] Version not compatible. expect(${keeper.__compatible_version__}), received(3.2.3)`,
    )
    expect(keeper.data).toEqual(undefined)

    await writeData('2.0.0', data.alice)
    await keeper.load()
    expect(keeper.data).toEqual(instance.alice)

    await writeData('2.0.3', data.bob)
    expect(keeper.data).toEqual(instance.alice)
    await keeper.load()
    expect(keeper.data).toEqual(instance.bob)
  })

  test('update / save / remove', async () => {
    await assertPromiseThrow(() => keeper.save(), '[BaseConfigKeeper.save] No valid data holding')
    await keeper.update(instance.alice)
    expect(keeper.data).toEqual(instance.alice)

    await rm(path.dirname(configFilepath))
    await writeFile(path.dirname(configFilepath), 'Hello, world!', 'utf8')
    await assertPromiseThrow(() => keeper.save(), `Parent path is not a dir`)

    await rm(path.dirname(configFilepath))
    await keeper.save()
    expect(isFileSync(configFilepath)).toEqual(true)
    expect(JSON.parse(await fs.readFile(configFilepath, 'utf8')).data).toEqual(data.alice)

    await keeper.update(instance.bob)
    expect(keeper.data).toEqual(instance.bob)
    expect(isFileSync(configFilepath)).toEqual(true)
    expect(JSON.parse(await fs.readFile(configFilepath, 'utf8')).data).toEqual(data.alice)

    await keeper.save()
    expect(isFileSync(configFilepath)).toEqual(true)
    expect(JSON.parse(await fs.readFile(configFilepath, 'utf8')).data).toEqual(data.bob)

    await keeper.destroy()
    expect(isFileSync(configFilepath)).toEqual(false)
    expect(keeper.data).toEqual(undefined)

    mkdirsIfNotExists(configFilepath, true)
    await assertPromiseThrow(() => keeper.destroy(), `Not a file`)
  })
}
