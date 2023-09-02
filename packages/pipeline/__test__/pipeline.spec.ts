import { PipelineStatusEnum } from '@guanghechen/constant'
import type { IPipelineMonitor } from '@guanghechen/types'
import { jest } from '@jest/globals'
import { Pipeline } from '../src'

interface IData {
  name: string
  count: number
}

class PipelineForTest extends Pipeline<string, IData> {
  protected count: number = 0

  public override async cook(material: string): Promise<IData | undefined> {
    if (/^\$/.test(material)) {
      this.count += 1
      return { name: material, count: this.count }
    }
    return undefined
  }
}

describe('Pipeline', () => {
  let pipeline: Pipeline<string, IData>

  beforeEach(() => {
    pipeline = new PipelineForTest() // You might need to adjust this based on your generics
  })

  it('should initialize with ALIVE status', () => {
    expect(pipeline.status).toBe(PipelineStatusEnum.ALIVE)
  })

  it('should close the pipeline', async () => {
    expect(pipeline.status).toBe(PipelineStatusEnum.ALIVE)
    await pipeline.close()
    expect(pipeline.status).toBe(PipelineStatusEnum.CLOSED)
  })

  it('should call onClosed monitor when closed', async () => {
    const monitor: Partial<IPipelineMonitor> = { onClosed: jest.fn(), onPushed: jest.fn() }
    pipeline.monitor(monitor)
    await pipeline.push('$test1')
    await pipeline.close()
    expect(monitor.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor.onPushed).toHaveBeenCalledTimes(1)
    expect(await pipeline.pull()).toEqual({ name: '$test1', count: 1 })
  })

  it('should skip when pull return a undefined value', async () => {
    const monitor1: Partial<IPipelineMonitor> = { onClosed: jest.fn(), onPushed: jest.fn() }
    const monitor2: Partial<IPipelineMonitor> = { onClosed: jest.fn(), onPushed: jest.fn() }
    const monitor3: Partial<IPipelineMonitor> = { onClosed: jest.fn() }
    const monitor4: Partial<IPipelineMonitor> = { onPushed: jest.fn() }
    const monitor5: Partial<IPipelineMonitor> = { onClosed: jest.fn(), onPushed: jest.fn() }

    pipeline.monitor(monitor1)
    const unsubscribe1 = pipeline.monitor(monitor2)
    pipeline.monitor(monitor3)
    pipeline.monitor(monitor4)

    expect(monitor1.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor1.onPushed).toHaveBeenCalledTimes(0)
    expect(monitor2.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor2.onPushed).toHaveBeenCalledTimes(0)
    expect(monitor3.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor4.onPushed).toHaveBeenCalledTimes(0)
    expect(monitor5.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor5.onPushed).toHaveBeenCalledTimes(0)

    await pipeline.push('test1')
    expect(pipeline.size).toEqual(1)

    await pipeline.push('$test2')
    expect(pipeline.size).toEqual(2)

    await pipeline.push('$test3')
    expect(pipeline.size).toEqual(3)

    await pipeline.push('test4')
    expect(pipeline.size).toEqual(4)

    unsubscribe1()

    await pipeline.push('test5')
    expect(pipeline.size).toEqual(5)

    await pipeline.push('$test6')
    expect(pipeline.size).toEqual(6)

    expect(await pipeline.pull()).toEqual({ name: '$test2', count: 1 })
    expect(pipeline.size).toEqual(4)

    await pipeline.close()
    expect(monitor1.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor1.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor2.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor2.onPushed).toHaveBeenCalledTimes(4)
    expect(monitor3.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor4.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor5.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor5.onPushed).toHaveBeenCalledTimes(0)

    await pipeline.close()
    expect(monitor1.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor1.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor2.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor2.onPushed).toHaveBeenCalledTimes(4)
    expect(monitor3.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor4.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor5.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor5.onPushed).toHaveBeenCalledTimes(0)

    expect(await pipeline.pull()).toEqual({ name: '$test3', count: 2 })
    expect(pipeline.size).toEqual(3)

    expect(await pipeline.pull()).toEqual({ name: '$test6', count: 3 })
    expect(pipeline.size).toEqual(0)

    expect(await pipeline.pull()).toEqual(undefined)
    expect(pipeline.size).toEqual(0)

    await pipeline.push('test7')
    expect(pipeline.size).toEqual(0)
    expect(monitor1.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor1.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor2.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor2.onPushed).toHaveBeenCalledTimes(4)
    expect(monitor3.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor4.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor5.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor5.onPushed).toHaveBeenCalledTimes(0)

    pipeline.monitor(monitor5)
    await pipeline.push('$test8')
    expect(pipeline.size).toEqual(0)
    expect(monitor1.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor1.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor2.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor2.onPushed).toHaveBeenCalledTimes(4)
    expect(monitor3.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor4.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor5.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor5.onPushed).toHaveBeenCalledTimes(0)
  })
})
