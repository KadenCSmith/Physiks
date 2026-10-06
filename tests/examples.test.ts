import { describe, expect, it } from 'vitest'
import katex from 'katex'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { models, oscillatorModel, relaxationModel } from '../src/models'
import type { NumericParameters } from '../src/framework/types'

describe('harmonic oscillator example', () => {
  it('satisfies both initial conditions and the force balance', () => {
    const p = { ...oscillatorModel.defaults, release: -0.23, initialVelocity: 0.4 }
    const initial = oscillatorModel.sample(p, 0)
    expect(initial.x).toBeCloseTo(p.release, 12)
    expect(initial.velocity).toBeCloseTo(p.initialVelocity, 12)
    for (const t of [0, 0.23, 1.1, 4.6]) {
      const s = oscillatorModel.sample(p, t)
      expect(p.mass * s.acceleration + p.spring * s.x).toBeCloseTo(0, 12)
    }
  })

  it('has derivatives consistent with its position and conserves energy', () => {
    const p = { ...oscillatorModel.defaults, mass: 3.2, spring: 11.4, initialVelocity: -0.31 }
    const e0 = 0.5 * p.mass * p.initialVelocity ** 2 + 0.5 * p.spring * p.release ** 2
    const h = 1e-5
    for (const t of [0.17, 0.51, 1.83, 6.2]) {
      const left = oscillatorModel.sample(p, t - h)
      const now = oscillatorModel.sample(p, t)
      const right = oscillatorModel.sample(p, t + h)
      expect((right.x - left.x) / (2 * h)).toBeCloseTo(now.velocity, 7)
      expect((right.velocity - left.velocity) / (2 * h)).toBeCloseTo(now.acceleration, 7)
      expect(now.totalEnergy).toBeCloseTo(e0, 12)
    }
  })

  it('joins its four-period loop without changing the physical state', () => {
    const p = { ...oscillatorModel.defaults, initialVelocity: 0.73 }
    const playback = oscillatorModel.getPlayback(p)
    expect(playback.loop).toBe(true)
    const start = oscillatorModel.sample(p, 0)
    expect(playback.duration / start.period).toBeCloseTo(4, 12)
    const end = oscillatorModel.sample(p, playback.duration)
    for (const key of ['x', 'velocity', 'acceleration', 'totalEnergy'] as const) expect(end[key]).toBeCloseTo(start[key], 12)
  })
})

describe('exponential relaxation example', () => {
  it('satisfies its initial condition, differential equation, and derivative', () => {
    const p = { initial: 0.82, target: 0.15, rate: 0.7 }
    expect(relaxationModel.sample(p, 0).value).toBe(p.initial)
    const h = 1e-5
    for (const t of [0.2, 0.8, 2, 5]) {
      const s = relaxationModel.sample(p, t)
      const difference = (relaxationModel.sample(p, t + h).value - relaxationModel.sample(p, t - h).value) / (2 * h)
      expect(s.derivative).toBeCloseTo(-p.rate * (s.value - p.target), 12)
      expect(difference).toBeCloseTo(s.derivative, 8)
    }
  })

  it('approaches either target monotonically without overshoot or looping', () => {
    for (const p of [{ initial: 0.9, target: 0.1, rate: 0.4 }, { initial: 0.2, target: 0.95, rate: 1.8 }]) {
      const playback = relaxationModel.getPlayback(p)
      expect(playback.loop).toBe(false)
      expect(playback.duration * p.rate).toBeCloseTo(5, 12)
      let previousGap = Math.abs(p.initial - p.target)
      for (let index = 0; index <= 20; index++) {
        const s = relaxationModel.sample(p, index * playback.duration / 20)
        expect(s.value).toBeGreaterThanOrEqual(Math.min(p.initial, p.target))
        expect(s.value).toBeLessThanOrEqual(Math.max(p.initial, p.target))
        expect(Math.abs(s.error)).toBeLessThanOrEqual(previousGap + 1e-14)
        previousGap = Math.abs(s.error)
      }
      const end = relaxationModel.sample(p, playback.duration)
      expect(end.error / (p.initial - p.target)).toBeCloseTo(Math.exp(-5), 12)
      expect(end.value).not.toBe(p.initial)
    }
  })

  it('halves the gap at its half-life and preserves exact equilibrium', () => {
    const p = relaxationModel.defaults
    const initial = relaxationModel.sample(p, 0)
    const half = relaxationModel.sample(p, initial.halfLife)
    expect(half.error).toBeCloseTo(initial.error / 2, 12)
    const equilibrium = { ...p, initial: 0.55, target: 0.55 }
    for (const t of [0, 1, 100]) {
      const s = relaxationModel.sample(equilibrium, t)
      expect(s.value).toBe(0.55)
      expect(s.derivative).toBe(0)
    }
  })
})

describe('replaceable example contracts', () => {
  it('provides finite playback windows, plotted keys, and snapshots at control boundaries', () => {
    for (const model of models) {
      const combinations: NumericParameters[] = [model.defaults]
      for (const control of model.controls) for (const edge of [control.min, control.max]) combinations.push({ ...model.defaults, [control.key]: edge })
      for (const p of combinations) {
        const playback = model.getPlayback(p)
        expect(Number.isFinite(playback.duration) && playback.duration > 0, model.id).toBe(true)
        for (const t of [0, playback.duration / 3, playback.duration, Number.NaN, Number.POSITIVE_INFINITY]) {
          const s = model.sample(p, t)
          expect(Object.values(s).every(Number.isFinite), model.id).toBe(true)
          for (const plot of model.plots ?? []) expect(Number.isFinite(s[plot.key]), `${model.id}:${plot.key}`).toBe(true)
          for (const readout of model.getReadouts(p, s)) expect(Number.isFinite(readout.value), `${model.id}:${readout.label}`).toBe(true)
        }
      }
    }
  })

  it('renders original formula entries with unique identifiers and clear provenance', () => {
    const ids = models.flatMap(model => model.formulas.map(formula => formula.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const model of models) for (const formula of model.formulas) {
      expect(formula.sources?.length).toBeGreaterThan(0)
      for (const source of formula.sources ?? []) expect(source).not.toMatch(/IMG_|Screenshot|Adobe Scan/)
      for (const tex of formula.tex) expect(() => katex.renderToString(tex, { throwOnError: true, strict: 'error' }), formula.id).not.toThrow()
    }
  })

  it('renders the scene and teaching content at defaults and control boundaries', () => {
    for (const model of models) {
      const parameters = [model.defaults]
      for (const control of model.controls) for (const edge of [control.min, control.max]) parameters.push({ ...model.defaults, [control.key]: edge })
      for (const p of parameters) for (const time of [0, model.getPlayback(p).duration / 2]) {
        const snapshot = model.sample(p, time)
        const scene = renderToStaticMarkup(createElement(model.Scene, {
          parameters: p, snapshot, display: { labels: true, forces: true },
          onParameterChange: () => {}, onInteractionStart: () => {}, onInteractionEnd: () => {},
        }))
        const lesson = renderToStaticMarkup(createElement(model.Lesson, { parameters: p, snapshot, time }))
        expect(scene, model.id).toContain('<svg')
        expect(lesson, model.id).toContain('<math')
        expect(scene + lesson, model.id).not.toMatch(/katex-error|NaN|Infinity/)
        if (model.Details) expect(renderToStaticMarkup(createElement(model.Details, { parameters: p, snapshot, time })).length).toBeGreaterThan(0)
      }
    }
  })
})
