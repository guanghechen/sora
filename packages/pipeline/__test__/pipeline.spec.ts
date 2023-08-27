import { jest } from '@jest/globals'
import type { IPipelineMonitor } from '../src'
import { Pipeline, PipelineStatus } from '../src'

interface IData {
  name: string
  count: number
}

class PipelineForTest extends Pipeline<string, IData> {
  protected count: number = 0

  public override cook(material: string): IData | undefined {
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
    expect(pipeline.status).toBe(PipelineStatus.ALIVE)
  })

  it('should close the pipeline', () => {
    expect(pipeline.status).toBe(PipelineStatus.ALIVE)
    pipeline.close()
    expect(pipeline.status).toBe(PipelineStatus.CLOSED)
  })

  it('should call onClosed monitor when closed', () => {
    const monitor: Partial<IPipelineMonitor> = { onClosed: jest.fn(), onPushed: jest.fn() }
    pipeline.monitor(monitor)
    pipeline.push('$test1')
    pipeline.close()
    expect(monitor.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor.onPushed).toHaveBeenCalledTimes(1)
    expect(pipeline.pull()).toEqual({ name: '$test1', count: 1 })
  })

  it('should skip when pull return a undefined value', () => {
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

    pipeline.push('test1')
    expect(pipeline.size).toEqual(1)

    pipeline.push('$test2')
    expect(pipeline.size).toEqual(2)

    pipeline.push('$test3')
    expect(pipeline.size).toEqual(3)

    pipeline.push('test4')
    expect(pipeline.size).toEqual(4)

    unsubscribe1()

    pipeline.push('test5')
    expect(pipeline.size).toEqual(5)

    pipeline.push('$test6')
    expect(pipeline.size).toEqual(6)

    expect(pipeline.pull()).toEqual({ name: '$test2', count: 1 })
    expect(pipeline.size).toEqual(4)

    pipeline.close()
    expect(monitor1.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor1.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor2.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor2.onPushed).toHaveBeenCalledTimes(4)
    expect(monitor3.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor4.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor5.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor5.onPushed).toHaveBeenCalledTimes(0)

    pipeline.close()
    expect(monitor1.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor1.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor2.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor2.onPushed).toHaveBeenCalledTimes(4)
    expect(monitor3.onClosed).toHaveBeenCalledTimes(1)
    expect(monitor4.onPushed).toHaveBeenCalledTimes(6)
    expect(monitor5.onClosed).toHaveBeenCalledTimes(0)
    expect(monitor5.onPushed).toHaveBeenCalledTimes(0)

    expect(pipeline.pull()).toEqual({ name: '$test3', count: 2 })
    expect(pipeline.size).toEqual(3)

    expect(pipeline.pull()).toEqual({ name: '$test6', count: 3 })
    expect(pipeline.size).toEqual(0)

    expect(pipeline.pull()).toEqual(undefined)
    expect(pipeline.size).toEqual(0)

    pipeline.push('test7')
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
    pipeline.push('$test8')
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
