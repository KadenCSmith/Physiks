import { createElement, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { advancePlayback, clampPlaybackTime, usePlayback } from '../src/framework/usePlayback'

describe('time advancement', () => {
  it('wraps periodic playback through one or many cycles at the requested viewing speed', () => {
    expect(advancePlayback(9, 20, 0.25, 10, true)).toBe(4)
    expect(advancePlayback(1, 21, 2, 10, true)).toBe(3)
    expect(advancePlayback(0, 5, 2, 10, true)).toBe(0)
    expect(advancePlayback(0.75, 0.5, 0.25, 1, true)).toBe(0.875)
  })

  it('stops a nonperiodic trajectory exactly at its endpoint and never wraps it', () => {
    expect(advancePlayback(0.2, 1, 2, 0.38, false)).toBe(0.38)
    expect(advancePlayback(0.38, 8, 1, 0.38, false)).toBe(0.38)
    expect(advancePlayback(3, 1, 0.5, 10, false)).toBe(3.5)
  })

  it('selects the same time regardless of how elapsed time is divided between frames', () => {
    for (const loop of [true, false]) {
      const whole = advancePlayback(0.3, 8, 0.7, 2, loop)
      const partitioned = [0.01, 0.02, 1.5, 0.47, 6].reduce((time, delta) => advancePlayback(time, delta, 0.7, 2, loop), 0.3)
      expect(partitioned).toBeCloseTo(whole, 14)
    }
  })

  it('handles invalid ranges, times, deltas, and speeds without producing nonfinite state', () => {
    for (const duration of [0, -1, NaN, Infinity]) {
      expect(advancePlayback(1, 1, 1, duration, true)).toBe(0)
      expect(clampPlaybackTime(1, duration)).toBe(0)
    }
    for (const time of [NaN, Infinity, -Infinity, -2]) expect(advancePlayback(time, 0.5, 1, 2, false)).toBe(0.5)
    for (const delta of [NaN, Infinity, -Infinity, -2]) expect(advancePlayback(0.5, delta, 1, 2, false)).toBe(0.5)
    for (const speed of [NaN, Infinity, -Infinity, -2, 0]) expect(advancePlayback(0.5, 0.5, speed, 2, false)).toBe(1)
    const hugePhase = advancePlayback(Number.MAX_VALUE * 0.8, Number.MAX_VALUE * 0.8, 1, Number.MAX_VALUE, true)
    expect(Number.isFinite(hugePhase)).toBe(true)
    expect(hugePhase).toBeGreaterThanOrEqual(0)
    expect(hugePhase).toBeLessThan(Number.MAX_VALUE)
    expect(advancePlayback(1, Number.MAX_VALUE, Number.MAX_VALUE, 10, false)).toBe(10)
  })

  it('clamps seek requests while allowing backward seeks away from a stopped endpoint', () => {
    expect(clampPlaybackTime(100, 10)).toBe(10)
    expect(clampPlaybackTime(3, 10)).toBe(3)
    expect(clampPlaybackTime(-5, 10)).toBe(0)
    expect(clampPlaybackTime(NaN, 10)).toBe(0)
    expect(advancePlayback(clampPlaybackTime(3, 10), 1, 1, 10, false)).toBe(4)
  })
})

describe('playback hook intent and server rendering', () => {
  it('starts in autoplay without requiring a browser and normalizes an invalid default speed', () => {
    function Initial() {
      const p = usePlayback(10, { loop: true, defaultSpeed: NaN })
      return createElement('output', null, `${p.time}|${p.playing}|${p.speed}|${p.ended}`)
    }
    expect(renderToStaticMarkup(createElement(Initial))).toBe('<output>0|true|1|false</output>')
  })

  it('preserves an explicit pause through forward seek, backward seek, and reset', () => {
    function Paused() {
      const p = usePlayback(10, { loop: false, defaultSpeed: 0.25 })
      const [stage, setStage] = useState(0)
      if (stage === 0) { p.setPlaying(false); p.seek(8); setStage(1) }
      if (stage === 1) { p.seek(3); p.setSpeed((speed) => speed * 2); setStage(2) }
      if (stage === 2) { p.reset(); setStage(3) }
      return createElement('output', null, `${p.time}|${p.playing}|${p.speed}|${p.ended}`)
    }
    expect(renderToStaticMarkup(createElement(Paused))).toBe('<output>0|false|0.5|false</output>')
  })

  it('marks a sought nonperiodic endpoint as ended and releases that state after seeking backward', () => {
    function Seeked() {
      const p = usePlayback(10, { loop: false, defaultSpeed: 1 })
      const [stage, setStage] = useState(0)
      const [reachedEnd, setReachedEnd] = useState(false)
      if (stage === 0) { p.seek(20); setStage(1) }
      if (stage === 1) { setReachedEnd(p.ended); p.seek(4); setStage(2) }
      return createElement('output', null, `${reachedEnd}|${p.time}|${p.playing}|${p.ended}`)
    }
    expect(renderToStaticMarkup(createElement(Seeked))).toBe('<output>true|4|true|false</output>')
  })

  it('normalizes invalid speed edits while keeping a temporarily disabled autoplay intent', () => {
    function Disabled() {
      const p = usePlayback(0, { loop: false, temporarilyPaused: true, disabled: true, defaultSpeed: 0.25 })
      const [changed, setChanged] = useState(false)
      if (!changed) { p.seek(Infinity); p.setSpeed(-2); setChanged(true) }
      return createElement('output', null, `${p.time}|${p.playing}|${p.speed}|${p.ended}`)
    }
    expect(renderToStaticMarkup(createElement(Disabled))).toBe('<output>0|true|0.25|false</output>')
  })
})
