import { useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { schedulePlaybackFrames } from '../src/framework/usePlayback'
import { buildPlotGeometry, TimeSeriesChart } from '../src/framework/TimeSeriesChart'
import { defineSimulation } from '../src/framework/model'

function frameScheduler() {
  let id = 0
  const pending = new Map<number, FrameRequestCallback>()
  return {
    request: (callback: FrameRequestCallback) => { pending.set(++id, callback); return id },
    cancel: (handle: number) => { pending.delete(handle) },
    frame: (timestamp: number) => {
      const callbacks = [...pending.values()]
      pending.clear()
      callbacks.forEach(callback => callback(timestamp))
    },
    get pending() { return pending.size },
  }
}

describe('display-paced playback', () => {
  it.each([60, 120, 144])('publishes every %s Hz frame without a lower-rate timing gate', rate => {
    const scheduler = frameScheduler()
    const time = { current: 0 }
    const onFrame = vi.fn()
    const stop = schedulePlaybackFrames({ time, duration: 20, speed: 0.25, loop: true,
      onFrame, now: () => 0, request: scheduler.request, cancel: scheduler.cancel })
    for (let frame = 1; frame <= rate * 2; frame++) scheduler.frame(frame * 1000 / rate)
    expect(onFrame).toHaveBeenCalledTimes(rate * 2)
    expect(time.current).toBeCloseTo(0.5, 13)
    stop()
    scheduler.frame(3000)
    expect(onFrame).toHaveBeenCalledTimes(rate * 2)
    expect(scheduler.pending).toBe(0)
  })

  it('stops exactly at a nonperiodic endpoint and schedules no further work', () => {
    const scheduler = frameScheduler()
    const onFrame = vi.fn()
    schedulePlaybackFrames({ time: { current: 0.9 }, duration: 1, speed: 1, loop: false,
      onFrame, now: () => 0, request: scheduler.request, cancel: scheduler.cancel })
    scheduler.frame(16)
    scheduler.frame(150)
    scheduler.frame(300)
    expect(onFrame.mock.calls.map(([time]) => time)).toEqual([0.916, 1])
    expect(scheduler.pending).toBe(0)
  })

  it('reads an exact seek/reset value and resumes without accumulating paused time', () => {
    const scheduler = frameScheduler()
    const time = { current: 3 }
    const onFrame = vi.fn()
    const options = { time, duration: 10, speed: 1, loop: true, onFrame,
      request: scheduler.request, cancel: scheduler.cancel }
    const stop = schedulePlaybackFrames({ ...options, now: () => 0 })
    scheduler.frame(16)
    time.current = 0.123456789
    scheduler.frame(32)
    expect(time.current).toBeCloseTo(0.139456789, 14)
    stop()
    time.current = 0
    schedulePlaybackFrames({ ...options, now: () => 10000 })
    scheduler.frame(10016)
    expect(time.current).toBe(0.016)
  })
})

describe('response geometry work', () => {
  it('samples and constructs one curve across 20 cursor updates, then rebuilds when parameters change', () => {
    let reads = 0
    const sample = vi.fn((parameters: Record<string, number>, time: number) => ({
      get value() { reads++; return parameters.level + time },
    }))
    const model = defineSimulation({
      id: 'frame-fixture', title: 'Frame fixture', description: 'Performance regression fixture.',
      defaults: { level: 1 }, controls: [{ key: 'level', label: 'Level', min: 0, max: 3, step: 1 }],
      sample, getPlayback: () => ({ duration: 4, loop: false }), getReadouts: () => [],
      plots: [{ key: 'value', label: 'Value' }], Scene: () => null, Lesson: () => null, formulas: [],
    })
    const initial = { level: 1 }, changed = { level: 2 }
    function Frames({ change = false }: { change?: boolean }) {
      const [frame, setFrame] = useState(0)
      // Calling the function here shares this harness's real React hook state
      // across render-phase updates, without introducing a browser test runtime.
      const chart = TimeSeriesChart({ model, parameters: change && frame >= 10 ? changed : initial,
        snapshot: { value: 1 + frame / 60 }, time: frame / 60, duration: 4, onSeek: () => {} })
      if (frame < 19) setFrame(frame + 1)
      return chart
    }
    const html = renderToStaticMarkup(<Frames />)
    expect(html).toContain('Value versus time')
    expect(sample).toHaveBeenCalledTimes(241)
    expect(reads).toBe(241 * 3)
    sample.mockClear(); reads = 0
    renderToStaticMarkup(<Frames change />)
    expect(sample).toHaveBeenCalledTimes(241 * 2)
    expect(reads).toBe(241 * 3 * 2)
  })

  it('keeps full-precision cursor coordinates and breaks the curve across unavailable samples', () => {
    const geometry = buildPlotGeometry([{ value: -1 }, { value: NaN }, { value: 1 }], 'value', 4)
    expect(geometry.path.match(/M/g)).toHaveLength(2)
    expect(geometry.path).not.toContain('NaN')
    expect(geometry.x(0.123456789)).toBe(60 + 680 * 0.123456789 / 4)
    expect(geometry.y(0)).toBe(92)
  })
})
